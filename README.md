# MRSA POT Explorer (Tabbed) v0.2

MRSA の POT データ（POT1-3）を CSV から読み込み、  
**POT 動態・プロファイル・アウトブレイク芽（Signal）・原データ表** を  
タブ形式で一括解析できる Web アプリです。

- 完全ローカル動作（データ送信なし）
- CSV を drag & drop / ファイル選択で読み込んで解析
- 期間・病棟・施設フィルタは全タブ共通
- 教育・研究（分子疫学・ICT/AST 支援）向け

---

## 📁 ディレクトリ構成（推奨）

MRSA-POT-Explorer/
├─ index.html
├─ style.css
├─ script.js
├─ instruction.html
├─ mrsa_sample_100records.csv ← これを「サンプル CSV」として読み込みたい
├─ README.md
└─ data/
└─ mrsa_sample_100records 2.csv

アプリから読み込むサンプル CSV は **data/** 内に置いてください。

---

## 🚀 起動方法

1. 全ファイルを同じフォルダに置く
2. `index.html` をブラウザで開く
3. 「サンプル CSV を読む」または任意の CSV を読み込む
4. フィルタを設定して「解析を更新」
5. 各タブで解析結果を確認する

---

## 📌 CSV 仕様

### ◆ 必須カラム（これが無いと動かない）

| カラム名        | 説明                      |
| --------------- | ------------------------- |
| collection_date | 分離日（yyyy-mm-dd 推奨） |
| ward            | 病棟                      |
| hospital        | 施設                      |
| specimen        | 検体                      |
| POT1            | POT digit 1               |
| POT2            | POT digit 2               |
| POT3            | POT digit 3               |

### ◆ 任意カラム（あれば解析がより濃くなる）

- onset_type
- patient_id
- clindamycin_R（0/1）
- vancomycin_MIC
- daptomycin_MIC
- など、その他自由に追加可能

### ◆ 欠損値の扱い

- ward / hospital / specimen の欠損 → `"unknown"`
- collection_date が欠損 → 時系列解析には含めない
- MIC などの数値欠損 → 0 として扱う

---

## 🧭 各タブの概要

### 🔹 Upload / Settings

- CSV 読み込み
- フィルタ（期間 / 病棟 / 施設）

### 🔹 Overview

- 分離数・ユニーク POT 数
- 病棟別棒グラフ
- 検体別 Pie
- 月別総件数折れ線

### 🔹 POT Trend

- 上位 POT の月別推移（最大 5 つ）

### 🔹 POT Profile

- POT × 病棟ヒートマップ
- POT ごとのカード表示
- 似ている POT（cosine 距離）を自動抽出
- ICU 侵襲型、市中皮膚軟部型などの自動ラベル

### 🔹 Signals

- 同一病棟 × 同一 POT で  
  **短期間に集中的に検出された “芽（signal）” を検出**
- sliding-window 方式（窓幅＋閾値を自由設定）
- タイムラインで最大 6 件可視化

### 🔹 Raw Table

- フィルタ後の生データを一覧
- POT / 病棟 / 検体 / patient_id で部分一致検索

---

## 🧪 Signal（アウトブレイク芽）の原理

- 期間幅（windowDays）内に  
  **k 件以上の連続（POT × 病棟）** を検出
- 例：
  - ICU で POT 106-77-113 が 14 日間で 4 件 → signal
- これは統計的有意差ではなく  
  **「次の ICT アクションのための芽拾い」** を目的とする

---

## 🔧 類似 POT の算出

各 POT について

- 病棟分布
- 検体分布
- onset 分布
- CLDM-R 率
- VCM MIC≥2
- DAP MIC≥1

のベクトルを作成し、  
**cosine similarity > 0.65** のものを「類似 POT」として表示。

---

## 📜 ライセンス & 免責

- 研究・教育目的で自由に利用可能
- 個人情報・施設情報の扱いは各施設の倫理規程に従ってください
- 解析結果のみで臨床判断を行わないでください

---

## 📝 更新履歴

- v0.2 — タブ化、Overview 追加、Profile 強化、Signal 機能強化、類似 POT 導入（cosine）
