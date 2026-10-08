import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

def main():
    model_id = "google/gemma-4-E4B-it"
    adapter_path = "./gemma-4-e4b-qlora-adapter"

    print("토크나이저 로드 중...")
    tokenizer = AutoTokenizer.from_pretrained(model_id)

    print("베이스 모델 로드 중 (메모리 절약을 위해 bfloat16 사용)...")
    base_model = AutoModelForCausalLM.from_pretrained(
        model_id, 
        device_map="auto",
        torch_dtype=torch.bfloat16
    )

    # 테스트할 프롬프트 (Gemma chat template 적용)
    question = "eBro 시스템의 주요 핵심 가치는 무엇입니까?"
    prompt = f"<bos><start_of_turn>user\n{question}<end_of_turn>\n<start_of_turn>model\n"
    
    inputs = tokenizer(prompt, return_tensors="pt").to(base_model.device)

    # 1. 베이스 모델로 추론
    print("\n==============================")
    print("🤖 [원본 Base 모델 답변 생성 중]")
    print("==============================")
    base_outputs = base_model.generate(**inputs, max_new_tokens=100, temperature=0.1)
    base_response = tokenizer.decode(base_outputs[0], skip_special_tokens=False)
    print(base_response)

    # 2. 파인튜닝된 LoRA 어댑터 적용
    print("\nLoRA 어댑터 적용 중...")
    finetuned_model = PeftModel.from_pretrained(base_model, adapter_path)

    # 3. 파인튜닝 모델로 추론
    print("\n==============================")
    print("🚀 [QLoRA 파인튜닝 모델 답변 생성 중]")
    print("==============================")
    finetuned_outputs = finetuned_model.generate(**inputs, max_new_tokens=100, temperature=0.1)
    finetuned_response = tokenizer.decode(finetuned_outputs[0], skip_special_tokens=False)
    print(finetuned_response)

if __name__ == "__main__":
    main()
