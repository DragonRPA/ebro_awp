import os
import subprocess
import json
import time

def run_cmd(cmd, check=True):
    print(f"\n[RUN] {cmd}")
    result = subprocess.run(cmd, shell=True)
    if check and result.returncode != 0:
        raise Exception(f"Command failed: {cmd}")

def kill_llama():
    print("\n[KILL] Stopping llama-server.exe...")
    subprocess.run("taskkill /F /IM llama-server.exe", shell=True, stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)

def start_llama(model_file):
    print(f"\n[START] Starting llama-server with {model_file}...")
    kill_llama()
    time.sleep(2)
    # Start in background
    subprocess.Popen(f".\\llama-bin\\llama-server.exe -m {model_file} --port 8080 -c 4096 -ngl 99", shell=True, creationflags=subprocess.CREATE_NEW_CONSOLE)
    print("Waiting 15 seconds for server to boot...")
    time.sleep(15)

def get_accuracy():
    if not os.path.exists("evaluation_summary.json"):
        return 0.0
    with open("evaluation_summary.json", "r", encoding="utf-8") as f:
        data = json.load(f)
        return data.get("accuracy", 0.0)

def main():
    iteration = 1
    best_acc = 0.0
    target_acc = 95.0
    
    while True:
        print(f"\n\n{'='*50}\n[ITERATION {iteration}]\n{'='*50}")
        
        # 1. Train
        run_cmd("python train_gemma4_qlora.py")
        
        # 2. Merge
        run_cmd("python merge_adapter.py")
        
        # 3. Convert
        model_name = f"ebro-agent-v{iteration}.gguf"
        run_cmd(f"python llama.cpp\\convert_hf_to_gguf.py ebro-gemma4-merged --outfile {model_name} --outtype q4_k_m")
        
        # 4. Restart Server
        start_llama(model_name)
        
        # 5. Evaluate
        print("\n[EVALUATE] Running evaluation script...")
        run_cmd("python evaluate_dataset.py")
        
        acc = get_accuracy()
        print(f"\n[RESULT] Iteration {iteration} Accuracy: {acc:.2f}%")
        
        if acc >= target_acc:
            print(f"SUCCESS! Target accuracy {target_acc}% reached. Stopping.")
            break
        else:
            print(f"Target not reached. Retrying...")
            iteration += 1
            # Improve dataset more if needed? The script 'improve_dataset.py' already fixed the main issue.
            # We can re-run it just in case, but it's idempotent.
            run_cmd("python improve_dataset.py")
            
    print("ALL DONE.")

if __name__ == '__main__':
    main()
