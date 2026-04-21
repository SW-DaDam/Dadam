"""
AI Hub 107번(자유대화)·94번(노인명령어) 데이터셋 전처리 스크립트
Colab Pro+ 환경에서 Google Drive 마운트 후 실행
출력: HuggingFace datasets 포맷 (train / valid 분리)

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
from datasets import Audio, Dataset, DatasetDict, Features, Sequence, Value, concatenate_datasets, load_from_disk

# ── 경로 설정 (Colab 환경 기준) ──────────────────────────────────────────────
DRIVE_ROOT = Path("/content/drive/MyDrive/Dadam_dataSet")

DIR_107_TRAIN = DRIVE_ROOT / "자유대화 음성(노인남녀)/Training"
DIR_107_VALID = DRIVE_ROOT / "자유대화 음성(노인남녀)/Validation"
DIR_94_TRAIN  = DRIVE_ROOT / "명령어 음성(노인남녀)/Training"
DIR_94_VALID  = DRIVE_ROOT / "명령어 음성(노인남녀)/Validation"

OUTPUT_DIR = Path("/content/drive/MyDrive/Dadam_dataSet/processed")
SHARD_DIR  = OUTPUT_DIR / "shards"   # shard 임시 저장 루트
FINAL_DIR  = OUTPUT_DIR / "senior_speech"  # 최종 DatasetDict
# HuggingFace Arrow 빌드 임시 캐시를 Drive에 저장 (Colab 로컬 디스크 고갈 방지)
CACHE_DIR  = OUTPUT_DIR / "_hf_cache"

# ── 오디오 설정 ──────────────────────────────────────────────────────────────
TARGET_SR    = 16_000  # Whisper 표준 입력 샘플레이트
MAX_DURATION = 30.0    # Whisper 최대 입력 길이(초) — 초과 클립 제외
MIN_DURATION = 0.5     # 너무 짧은 클립 제외

# ── 텍스트 정규화 ─────────────────────────────────────────────────────────────
_NOISE_PATTERN = re.compile(
    r"\(noise\)|\(laugh\)|\(cough\)|\(breath\)|\(unclear\)|"
    r"\+|\*|/|\[.*?\]|\{.*?\}|<.*?>",
    re.IGNORECASE,
)
_MULTI_SPACE = re.compile(r"\s{2,}")


def normalize_text(text: str) -> str:
    """발화 노이즈 태그·특수 마커 제거 후 공백 정리"""
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
    # ── 1단계: 라벨 zip → file_name 기준 메타 딕셔너리 구성
    meta_map: dict[str, dict] = {}
    stem_map: dict[str, dict] = {}  # 확장자 제거 stem → meta (오타 폴백용)
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

    # ── 2단계: 원천 zip → 오디오 매칭 후 yield
    matched = skipped = 0
    with zipfile.ZipFile(zip_audio, "r") as za:
        for name in za.namelist():
            if not name.lower().endswith(audio_ext):
                continue

            base_name = Path(name).name
            # fileNm 오타(.wavp 등) 대응: 정확한 파일명 먼저, 실패 시 stem 폴백
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
                # numpy array로 명시 — from_generator 직렬화 후 list가 되는 것을 방지
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
    """split에 따른 (라벨 zip, 원천 zip) 목록 반환"""
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
    else:  # valid
        return [
            (DIR_107_VALID / "[라벨]1.AI챗봇.zip",      DIR_107_VALID / "[원천]1.AI챗봇.zip"),
            (DIR_107_VALID / "[라벨]2.음성수집도구.zip", DIR_107_VALID / "[원천]2.음성수집도구.zip"),
            (DIR_94_VALID / "[라벨]1.AI비서_라벨링_명령어(노년)_validation.zip", DIR_94_VALID / "[원천]1.AI비서_원천_1_명령어(노인)_validation.zip"),
            (DIR_94_VALID / "[라벨]4.비정형_라벨링_명령어(노년)_validation.zip", DIR_94_VALID / "[원천]4.비정형_원천_1_명령어(노년)_validation.zip"),
        ]


# ── shard 이름 생성 ───────────────────────────────────────────────────────────
def shard_name(index: int, zip_audio: Path) -> str:
    """인덱스 + 원천 zip명 기반 shard 디렉터리명 생성"""
    slug = re.sub(r"[^\w가-힣]", "_", zip_audio.stem)
    return f"{index:02d}_{slug}"


# ── manifest 헬퍼 ─────────────────────────────────────────────────────────────
def load_manifest(manifest_path: Path) -> set[str]:
    """완료된 shard ID 목록 로드 — 파일 없으면 빈 set 반환"""
    if not manifest_path.exists():
        return set()
    with manifest_path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    return set(data.get("completed", []))


def append_manifest(manifest_path: Path, shard_id: str) -> None:
    """shard 저장 성공 후 manifest에 shard_id 추가"""
    completed = load_manifest(manifest_path)
    completed.add(shard_id)
    with manifest_path.open("w", encoding="utf-8") as f:
        json.dump({"completed": sorted(completed)}, f, ensure_ascii=False)


# ── split 단위 처리 (shard 저장 + resume) ────────────────────────────────────
def process_split(split: str) -> None:
    """
    zip 쌍 하나마다 shard를 Drive에 즉시 저장
    _manifest.json으로 완료된 shard는 skip하여 재실행 시 resume 가능
    """
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
            # features를 미리 선언해 Audio 타입을 generator 단계에서 확정
            # cast_column 대신 이 방식을 사용하면 list→numpy 변환 오류를 방지
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
                cache_dir=str(CACHE_DIR),  # Arrow 빌드 캐시를 Drive에 저장해 로컬 디스크 고갈 방지
            )
            ds.save_to_disk(str(shard_path))
        except Exception as e:
            # 부분 저장 방지: 실패한 shard 디렉터리 삭제 후 raise
            if shard_path.exists():
                shutil.rmtree(shard_path)
            raise RuntimeError(f"shard 저장 실패 ({sid}): {e}") from e

        # save_to_disk 성공 후에만 manifest 갱신
        append_manifest(manifest_path, sid)
        print(f"  → shard 저장 완료: {shard_path}")


# ── shard 병합 ────────────────────────────────────────────────────────────────
def merge_shards(split: str) -> Dataset:
    """완료된 shard를 모두 로드하여 하나의 Dataset으로 병합"""
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
    CACHE_DIR.mkdir(parents=True, exist_ok=True)  # Arrow 캐시 디렉터리 사전 생성

    # 1단계: split별 shard 저장 (resume 지원)
    process_split("train")
    process_split("valid")

    # 2단계: shard 병합 후 최종 DatasetDict 저장
    print("\n=== shard 병합 중 ===")
    train_ds = merge_shards("train")
    valid_ds  = merge_shards("valid")

    ds_dict = DatasetDict({"train": train_ds, "validation": valid_ds})
    ds_dict.save_to_disk(str(FINAL_DIR))

    print(f"\n저장 완료: {FINAL_DIR}")
    print(ds_dict)


if __name__ == "__main__":
    main()
