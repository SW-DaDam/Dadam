# 셀 04 — 모델·프로세서 로드 및 LoRA 설정
import torch
from pathlib import Path
from datasets import load_from_disk
from transformers import WhisperProcessor, WhisperForConditionalGeneration
from peft import LoraConfig, get_peft_model, TaskType

MODEL_ID    = 'openai/whisper-large-v3'
DATASET_PATH = Path("/content/drive/MyDrive/Dadam_dataSet/processed/senior_speech")

# 프로세서: 오디오 → log-mel 스펙트로그램 + 토크나이저
processor = WhisperProcessor.from_pretrained(MODEL_ID, language='Korean', task='transcribe')

# 베이스 모델 로드
model = WhisperForConditionalGeneration.from_pretrained(MODEL_ID, torch_dtype=torch.float16)
model.config.forced_decoder_ids = processor.get_decoder_prompt_ids(language='Korean', task='transcribe')
model.config.suppress_tokens = []

# LoRA 설정 — encoder·decoder attention 레이어에만 적용해 VRAM 절감
lora_config = LoraConfig(
    task_type=TaskType.SEQ_2_SEQ_LM,
    r=32,
    lora_alpha=64,
    target_modules=['q_proj', 'v_proj'],  # attention Q·V 프로젝션만 학습
    lora_dropout=0.05,
    bias='none',
)
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()

# 데이터셋 로드
dataset = load_from_disk(str(DATASET_PATH))
print(dataset)
