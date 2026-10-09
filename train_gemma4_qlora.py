import os
import torch
from datasets import load_dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer

def main():
    # 1. 모델 ID 설정 (Hugging Face 리포지토리 기준)
    model_id = "google/gemma-4-E4B-it"  # Instruct 모델 기준 (필요시 "google/gemma-4-E4B"로 변경)
    dataset_path = "ebro_38menu_dataset.jsonl"
    output_dir = "./gemma-4-e4b-qlora-results"
    adapter_dir = "./gemma-4-e4b-qlora-adapter"

    print(f"[{model_id}] 모델 로드를 시작합니다...")

    # 2. 4-bit 양자화 설정 (QLoRA)
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16 # Ampere 이상 GPU 권장. 구형 GPU는 float16 사용
    )

    # 3. 토크나이저 및 모델 로드
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    # Gemma 모델의 경우 패딩 토큰을 eos_token으로 설정
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    model = AutoModelForCausalLM.from_pretrained(
        model_id,
        quantization_config=bnb_config,
        device_map="auto"
    )

    # 4. 모델을 QLoRA 훈련용으로 준비
    model = prepare_model_for_kbit_training(model)

    peft_config = LoraConfig(
        r=16,
        lora_alpha=32,
        target_modules=["q_proj.linear", "o_proj.linear", "k_proj.linear", "v_proj.linear", "gate_proj.linear", "up_proj.linear", "down_proj.linear"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM"
    )
    
    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()

    # 5. 데이터셋 로드
    print(f"[{dataset_path}] 데이터셋을 로드합니다...")
    dataset = load_dataset('json', data_files=dataset_path, split='train')

    # 6. 훈련 설정
    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=5,
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        optim="paged_adamw_32bit",
        save_steps=50,
        logging_steps=10,
        learning_rate=2e-4,
        weight_decay=0.001,
        fp16=True,
        bf16=False, # GPU가 지원하지 않으면 fp16=True, bf16=False 로 변경
        max_grad_norm=0.3,
        max_steps=-1,
        # warmup_ratio=0.03,
        # group_by_length=True,
        lr_scheduler_type="cosine",
        report_to="none" # wandb 등을 사용하려면 "wandb"로 변경
    )

    # 7. 표준 Trainer 사용 (trl 라이브러리 버전 호환성 문제 완벽 차단)
    def tokenize_func(examples):
        return tokenizer(examples["text"], truncation=True, max_length=1024)
    
    tokenized_dataset = dataset.map(tokenize_func, batched=True)
    
    from transformers import Trainer, DataCollatorForLanguageModeling
    data_collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)

    trainer = Trainer(
        model=model,
        train_dataset=tokenized_dataset,
        args=training_args,
        data_collator=data_collator,
    )

    print("훈련을 시작합니다!")
    trainer.train()

    # 8. 파인튜닝된 어댑터 가중치 저장
    print(f"훈련 완료! 어댑터를 [{adapter_dir}]에 저장합니다.")
    trainer.model.save_pretrained(adapter_dir)
    tokenizer.save_pretrained(adapter_dir)

if __name__ == "__main__":
    main()
