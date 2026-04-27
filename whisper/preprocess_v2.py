"""
AI Hub 107번(자유대화)·94번(노인명령어) 데이터셋 전처리 스크립트 v2
preprocess.py 대비 변경 사항:
  - normalize_text: SP/FP/기타 태그 처리 추가
  - 출력 경로: processed/senior_speech_v2 (기존 데이터 보존)

중간 저장 전략:
- zip 쌍 하나마다 shard로 즉시 Drive 저장 → 세션 종료 시 손실 최소화
- _manifest.json으로 완료된 shard를 기록, 재실행 시 skip (resume)
- 전체 완료 후 shard를 병합하여 최종 DatasetDict 저장
"""

import io
import json
import re
import shutil
import zipfile
from pathlib import Path
from typing import Generator, Optional

import numpy as np
import librosa
from datasets import Audio, Dataset, DatasetDict, Features, Value, concatenate_datasets, load_from_disk

# ── 경로 설정 (Colab 환경 기준) ──────────────────────────────────────────────
DRIVE_ROOT = Path("/content/drive/MyDrive/Dadam_dataSet")

DIR_107_TRAIN = DRIVE_ROOT / "자유대화 음성(노인남녀)/Training"
DIR_107_VALID = DRIVE_ROOT / "자유대화 음성(노인남녀)/Validation"
DIR_94_TRAIN  = DRIVE_ROOT / "명령어 음성(노인남녀)/Training"
DIR_94_VALID  = DRIVE_ROOT / "명령어 음성(노인남녀)/Validation"

OUTPUT_DIR = Path("/content/drive/MyDrive/Dadam_dataSet/processed")
SHARD_DIR  = OUTPUT_DIR / "shards_v2"          # v1과 충돌 방지
FINAL_DIR  = OUTPUT_DIR / "senior_speech_v2"   # 기존 senior_speech 보존
CACHE_DIR  = OUTPUT_DIR / "_hf_cache_v2"

# ── 오디오 설정 ──────────────────────────────────────────────────────────────
TARGET_SR    = 16_000
MAX_DURATION = 30.0
MIN_DURATION = 0.5

# ── 텍스트 정규화 ─────────────────────────────────────────────────────────────
# SP 태그: (SP: 발음) → 발음 그대로 유지 (모델이 실제 들리는 소리를 학습하도록)
# FP 태그: (FP: ...) → 제거 (채움말·간투사 표시)
# 기타 태그: (noise) (laugh) [...] 등 → 제거
_SP_PATTERN    = re.compile(r"\(SP:\s*([^)]+)\)")   # (SP: 내용) → 내용 추출
_TAG_PATTERN   = re.compile(r"\([A-Z]+:[^)]*\)")    # FP/기타 태그 제거
_NOISE_PATTERN = re.compile(
    r"\(noise\)|\(laugh\)|\(cough\)|\(breath\)|\(unclear\)|"
    r"\+|\*|/|\[.*?\]|\{.*?\}|<.*?>",
    re.IGNORECASE,
)
_MULTI_SPACE = re.compile(r"\s{2,}")


def normalize_text(text: str) -> str:
    """
    발화 전사 텍스트 정규화
    처리 순서:
      1. (SP: 발음) — 발음 내용으로 교체 (화자가 실제 발음한 형태 유지)
      2. (FP:...) 등 기타 대문자 태그 — 제거
      3. [소음] {기타} <마커> 등 — 제거
      4. 다중 공백 정리
    """
    # SP 태그: 발음 내용으로 교체 — (SP: 삼) → 삼
    text = _SP_PATTERN.sub(lambda m: m.group(1), text)
    # FP 등 나머지 대문자 태그 제거
    text = _TAG_PATTERN.sub(" ", text)
    # 소음·웃음 등 노이즈 태그 제거
    text = _NOISE_PATTERN.sub(" ", text)
    text = _MULTI_SPACE.sub(" ", text)
    return text.strip()


# ── JSON 파서 ─────────────────────────────────────────────────────────────────
def _parse_raw(raw: dict) -> Optional[dict]:
    """
    107번·94번 포맷을 키 존재 여부로 자동 감지 후 파싱
    반환: {file_name, text, duration, dataset, domain, region, gender, age}
    실패: None
    """
    # 107번 포맷: "발화정보" 키
    if "발화정보" in raw:
        utterance = raw["발화정보"]
        text    = utterance.get("stt", "").strip()
        file_nm = utterance.get("fileNm", "").strip()
        try:
            duration = float(utterance.get("recrdTime") or 0)
        except (ValueError, TypeError):
            duration = 0.0

        if not text or not file_nm:
            return None

        return {
            "file_name": file_nm,
            "text":      normalize_text(text),
            "duration":  duration,
            "dataset":   "107",
            "domain":    raw.get("대화정보", {}).get("colctUnitCode", ""),
            "region":    raw.get("대화정보", {}).get("cityCode", ""),
            "gender":    raw.get("녹음자정보", {}).get("gender", ""),
            "age":       str(raw.get("녹음자정보", {}).get("age", "")),
        }

    # 94번 포맷: "전사정보" 키
    if "전사정보" in raw:
        text      = raw.get("전사정보", {}).get("LabelText", "").strip()
        file_info = raw.get("파일정보", {})
        file_nm   = file_info.get("FileName", "").strip()
        try:
            duration = float(file_info.get("FileLength") or 0)
        except (ValueError, TypeError):
            duration = 0.0

        speaker = raw.get("화자정보", {})

        if not text or not file_nm:
            return None

        return {
            "file_name": file_nm,
            "text":      normalize_text(text),
            "duration":  duration,
            "dataset":   "94",
            "domain":    raw.get("기본정보", {}).get("DataCategory", ""),
            "region":    speaker.get("Region", ""),
            "gender":    speaker.get("Gender", ""),
            "age":       str(speaker.get("Age", "")),
        }

    return None


# ── zip 쌍 처리 ───────────────────────────────────────────────────────────────
def iter_zip_pairs(
    zip_label: Path,
    zip_audio: Path,
    audio_ext: str = ".wav",
) -> Generator[dict, None, None]:
    """
    라벨링 zip에서 JSON 메타를 로드하고, 원천 zip의 오디오와 매칭하여 yield
    - stem_map 폴백: fileNm이 .wavp 등 오타인 경우도 확장자 제거 stem으로 매칭
    - 오디오는 BytesIO로 감싸서 librosa에 전달 (ZipExtFile 직접 전달 시 seek 실패 방지)
    """
    meta_map: dict[str, dict] = {}
    stem_map: dict[str, dict] = {}
    with zipfile.ZipFile(zip_label, "r") as zl:
        for name in zl.namelist():
            if not name.lower().endswith(".json"):
                continue
            with zl.open(name) as jf:
                try:
                    raw  = json.load(jf)
                    meta = _parse_raw(raw)
                    if meta:
                        meta_map[meta["file_name"]] = meta
                        stem_map[Path(meta["file_name"]).stem] = meta
                except Exception:
                    pass

    print(f"  라벨 로드 완료: {len(meta_map)}개 ({zip_label.name})")

    matched = skipped = 0
    with zipfile.ZipFile(zip_audio, "r") as za:
        for name in za.namelist():
            if not name.lower().endswith(audio_ext):
                continue

            base_name = Path(name).name
            meta = meta_map.get(base_name) or stem_map.get(Path(name).stem)
            if not meta:
                skipped += 1
                continue

            with za.open(name) as af:
                try:
                    audio_bytes = io.BytesIO(af.read())
                    audio, _    = librosa.load(audio_bytes, sr=TARGET_SR, mono=True)
                except Exception as e:
                    print(f"  [WARN] 오디오 로드 실패: {base_name} — {e}")
                    skipped += 1
                    continue

            duration = len(audio) / TARGET_SR
            if not (MIN_DURATION <= duration <= MAX_DURATION):
                skipped += 1
                continue

            matched += 1
            yield {
                "audio":    {"array": np.array(audio, dtype=np.float32), "sampling_rate": TARGET_SR},
                "text":     meta["text"],
                "duration": duration,
                "dataset":  meta["dataset"],
                "domain":   meta["domain"],
                "region":   meta["region"],
                "gender":   meta["gender"],
                "age":      meta["age"],
            }

    total = matched + skipped
    ratio = f"{matched/total*100:.1f}%" if total else "N/A"
    print(f"  매칭: {matched}개 / 스킵: {skipped}개 ({zip_audio.name}) — 매칭률: {ratio}")


# ── 데이터셋 zip 쌍 목록 ──────────────────────────────────────────────────────
def get_pairs(split: str) -> list[tuple[Path, Path]]:
    if split == "train":
        return [
            (DIR_107_TRAIN / "[라벨]1.AI챗봇.zip",       DIR_107_TRAIN / "[원천]1.AI챗봇_1.zip"),
            (DIR_107_TRAIN / "[라벨]1.AI챗봇.zip",       DIR_107_TRAIN / "[원천]1.AI챗봇_2.zip"),
            (DIR_107_TRAIN / "[라벨]2.음성수집도구.zip",  DIR_107_TRAIN / "[원천]2.음성수집도구_1.zip"),
            (DIR_94_TRAIN / "[라벨]1.AI비서_라벨링_명령어(노년)_training.zip",  DIR_94_TRAIN / "[원천]1.AI비서_원천_1_명령어(노인)_training.zip"),
            (DIR_94_TRAIN / "[라벨]1.AI비서_라벨링_명령어(노년)_training.zip",  DIR_94_TRAIN / "[원천]1.AI비서_원천_8_명령어(노인)_training.zip"),
            (DIR_94_TRAIN / "[라벨]4.비정형_라벨링_명령어(노년)_training.zip",  DIR_94_TRAIN / "[원천]4.비정형_원천_10_명령어(노년)_training.zip"),
            (DIR_94_TRAIN / "[라벨]4.비정형_라벨링_명령어(노년)_training.zip",  DIR_94_TRAIN / "[원천]4.비정형_원천_11_명령어(노년)_training.zip"),
        ]
    else:
        return [
            (DIR_107_VALID / "[라벨]1.AI챗봇.zip",      DIR_107_VALID / "[원천]1.AI챗봇.zip"),
            (DIR_107_VALID / "[라벨]2.음성수집도구.zip", DIR_107_VALID / "[원천]2.음성수집도구.zip"),
            (DIR_94_VALID / "[라벨]1.AI비서_라벨링_명령어(노년)_validation.zip", DIR_94_VALID / "[원천]1.AI비서_원천_1_명령어(노인)_validation.zip"),
            (DIR_94_VALID / "[라벨]4.비정형_라벨링_명령어(노년)_validation.zip", DIR_94_VALID / "[원천]4.비정형_원천_1_명령어(노년)_validation.zip"),
        ]


# ── shard 이름 생성 ───────────────────────────────────────────────────────────
def shard_name(index: int, zip_audio: Path) -> str:
    slug = re.sub(r"[^\w가-힣]", "_", zip_audio.stem)
    return f"{index:02d}_{slug}"


# ── manifest 헬퍼 ─────────────────────────────────────────────────────────────
def load_manifest(manifest_path: Path) -> set[str]:
    if not manifest_path.exists():
        return set()
    with manifest_path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    return set(data.get("completed", []))


def append_manifest(manifest_path: Path, shard_id: str) -> None:
    completed = load_manifest(manifest_path)
    completed.add(shard_id)
    with manifest_path.open("w", encoding="utf-8") as f:
        json.dump({"completed": sorted(completed)}, f, ensure_ascii=False)


# ── split 단위 처리 ───────────────────────────────────────────────────────────
def process_split(split: str) -> None:
    shard_root    = SHARD_DIR / split
    manifest_path = shard_root / "_manifest.json"
    shard_root.mkdir(parents=True, exist_ok=True)

    completed = load_manifest(manifest_path)
    pairs     = get_pairs(split)

    print(f"\n=== {split} 셋 구성 중 ({len(pairs)}개 zip 쌍) ===")

    for idx, (zip_label, zip_audio) in enumerate(pairs):
        sid = shard_name(idx, zip_audio)

        if sid in completed:
            print(f"[SKIP] 이미 처리됨: {sid}")
            continue
        if not zip_label.exists():
            print(f"[SKIP] 파일 없음: {zip_label}")
            continue
        if not zip_audio.exists():
            print(f"[SKIP] 파일 없음: {zip_audio}")
            continue

        print(f"\n처리 중: {zip_audio.name}  →  shard: {sid}")
        shard_path = shard_root / sid

        try:
            features = Features({
                "audio":    Audio(sampling_rate=TARGET_SR),
                "text":     Value("string"),
                "duration": Value("float32"),
                "dataset":  Value("string"),
                "domain":   Value("string"),
                "region":   Value("string"),
                "gender":   Value("string"),
                "age":      Value("string"),
            })
            ds = Dataset.from_generator(
                lambda zl=zip_label, za=zip_audio: iter_zip_pairs(zl, za),
                features=features,
                cache_dir=str(CACHE_DIR),
            )
            ds.save_to_disk(str(shard_path))
        except Exception as e:
            if shard_path.exists():
                shutil.rmtree(shard_path)
            raise RuntimeError(f"shard 저장 실패 ({sid}): {e}") from e

        append_manifest(manifest_path, sid)
        print(f"  → shard 저장 완료: {shard_path}")


# ── shard 병합 ────────────────────────────────────────────────────────────────
def merge_shards(split: str) -> Dataset:
    shard_root = SHARD_DIR / split
    completed  = load_manifest(shard_root / "_manifest.json")

    shards = []
    for sid in sorted(completed):
        shard_path = shard_root / sid
        if shard_path.exists():
            shards.append(load_from_disk(str(shard_path)))

    if not shards:
        raise ValueError(f"{split} shard가 하나도 없습니다.")

    return concatenate_datasets(shards)


# ── 메인 파이프라인 ───────────────────────────────────────────────────────────
def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    process_split("train")
    process_split("valid")

    print("\n=== shard 병합 중 ===")
    train_ds = merge_shards("train")
    valid_ds  = merge_shards("valid")

    ds_dict = DatasetDict({"train": train_ds, "validation": valid_ds})
    ds_dict.save_to_disk(str(FINAL_DIR))

    print(f"\n저장 완료: {FINAL_DIR}")
    print(ds_dict)


if __name__ == "__main__":
    main()
