import zipfile
import json

label_zip = "/content/drive/MyDrive/Dadam_dataSet/자유대화 음성(노인남녀)/Training/[라벨]2.음성수집도구.zip"

with zipfile.ZipFile(label_zip) as zl:
    json_files = [n for n in zl.namelist() if n.endswith(".json")][:1]
    with zl.open(json_files[0]) as jf:
        raw = json.load(jf)
        print(json.dumps(raw, ensure_ascii=False, indent=2))
