"""
generate_qi_2023_200r.py
Generates Synthetic_QI_Data_2023_200r_4q.csv

200 residents x 4 assessment dates = 800 rows
Assessment dates: 2023-03-31, 2023-06-30, 2023-09-30, 2023-12-31

Narrative: A facility emerging from COVID disruptions in early 2023.
- Q1: post-COVID backlog — high PI, high falls, staffing still short
- Q2: recovery begins — new DON hired, medication audit starts
- Q3: improvement visible — falls program kicks in, AH gap narrows
- Q4: strong finish — most indicators improving, but RP creeping up
  (seeds the concerning 2024 RP trend)
"""

import random
import csv
import math
import os

random.seed(2023)

DATES = ["2023-03-31", "2023-06-30", "2023-09-30", "2023-12-31"]
N_RESIDENTS = 200
RESIDENTS = [f"R-{i:03d}" for i in range(1, N_RESIDENTS + 1)]

BINARY_PROBS = {
    # QI 1 — PI: high post-COVID, steady improvement as wound care program resumes
    "PI_01":    [0.18, 0.15, 0.12, 0.10],
    "PI_S1":    [0.06, 0.05, 0.04, 0.03],
    "PI_S2":    [0.06, 0.05, 0.04, 0.03],
    "PI_S3":    [0.03, 0.025, 0.02, 0.02],
    "PI_S4":    [0.015, 0.012, 0.008, 0.008],
    "PI_US":    [0.01, 0.008, 0.006, 0.005],
    "PI_DTI":   [0.005, 0.005, 0.004, 0.003],

    # QI 2 — RP: low early in year, creeping up by Q4 (early warning for 2024 trend)
    "RP_01":       [0.04, 0.04, 0.05, 0.06],
    "RP_MECH":     [0.015, 0.018, 0.02, 0.025],
    "RP_PHYS":     [0.012, 0.012, 0.015, 0.02],
    "RP_ENV":      [0.008, 0.008, 0.01, 0.012],
    "RP_SECLUSION":[0.005, 0.002, 0.005, 0.003],

    # QI 3 — UWL: elevated post-COVID (malnutrition), nutrition program starts Q2
    "UWL_SIG":  [0.09, 0.08, 0.065, 0.055],
    "UWL_CON":  [0.05, 0.042, 0.035, 0.03],

    # QI 4 — Falls: high baseline, falls prevention program from Q3
    "FALL_01":  [0.11, 0.12, 0.09, 0.075],
    "FALL_MAJ": [0.025, 0.028, 0.018, 0.014],

    # QI 5 — Meds: high polypharmacy, medication audit begins Q2 but takes time
    "MED_POLY": [0.30, 0.28, 0.25, 0.22],

    # QI 6 — ADL: declining cohort, minimal intervention capacity in 2023
    "ADL_01":   [0.12, 0.14, 0.15, 0.16],

    # QI 7 — IC: fluctuating, slight worsening mid-year, recovers
    "IC_INCONTINENCE": [0.38, 0.40, 0.42, 0.40],
    "IC_IAD":   [0.06, 0.07, 0.08, 0.065],
    "IC_IAD_1A":[0.025, 0.028, 0.03, 0.025],
    "IC_IAD_1B":[0.015, 0.018, 0.022, 0.018],
    "IC_IAD_2A":[0.01, 0.012, 0.015, 0.012],
    "IC_IAD_2B":[0.01, 0.012, 0.013, 0.01],

    # QI 8 — Hosp: high Q1 (post-COVID ED presentations), improving
    "HOSP_ED":  [0.15, 0.12, 0.10, 0.09],
    "HOSP_ALL": [0.11, 0.09, 0.08, 0.07],

    # QI 13 — AH: understaffed early, ramp-up from Q3 after allied health hiring
    "AH_REC_RECOMMENDED": [0.65, 0.68, 0.72, 0.75],
    "AH_REC_RECEIVED":    [0.35, 0.38, 0.48, 0.55],
    "AH_RCMD_PHYSIO":     [0.35, 0.38, 0.40, 0.42],
    "AH_RCMD_OT":         [0.25, 0.27, 0.30, 0.32],
    "AH_RCMD_SPEECH":     [0.12, 0.13, 0.15, 0.16],
    "AH_RCMD_POD":        [0.22, 0.23, 0.25, 0.26],
    "AH_RCMD_DIET":       [0.18, 0.19, 0.22, 0.24],
    "AH_RCMD_OTHER":      [0.08, 0.09, 0.10, 0.12],
    "AH_RCMD_ASSIST":     [0.10, 0.12, 0.15, 0.17],
    "AH_RCVD_PHYSIO":     [0.20, 0.25, 0.32, 0.38],
    "AH_RCVD_OT":         [0.15, 0.18, 0.24, 0.28],
    "AH_RCVD_SPEECH":     [0.06, 0.08, 0.12, 0.14],
    "AH_RCVD_POD":        [0.14, 0.16, 0.20, 0.24],
    "AH_RCVD_DIET":       [0.10, 0.12, 0.18, 0.20],
    "AH_RCVD_OTHER":      [0.05, 0.06, 0.08, 0.10],
    "AH_RCVD_ASSIST":     [0.08, 0.10, 0.14, 0.16],

    # QI 9 — WF adequate: not adequate all year (staffing crisis)
    "WF_ADEQUATE": [0, 0, 0, 0],
}

# MED_AP ternary: high "without diagnosis" all year, slow improvement
MED_AP_PROBS = [
    [0.68, 0.10, 0.22],   # Q1 — 22% without dx (very high)
    [0.69, 0.11, 0.20],   # Q2
    [0.72, 0.10, 0.18],   # Q3 — audit starts
    [0.74, 0.10, 0.16],   # Q4 — some improvement
]

MED_COUNT_MEANS = [8.2, 8.0, 7.5, 7.2]
MED_COUNT_STD = 3.2

ADL_MEANS = {
    "ADL_BOWEL":    [2.35, 2.30, 2.28, 2.25],
    "ADL_BLADDER":  [2.20, 2.18, 2.15, 2.12],
    "ADL_GROOMING": [2.45, 2.42, 2.40, 2.38],
    "ADL_TOILET":   [2.15, 2.12, 2.08, 2.05],
    "ADL_FEEDING":  [2.55, 2.52, 2.50, 2.48],
    "ADL_TRANSFER": [2.10, 2.05, 2.00, 1.95],
    "ADL_MOBILITY": [2.00, 1.95, 1.92, 1.88],
    "ADL_DRESSING": [2.20, 2.15, 2.12, 2.10],
    "ADL_STAIRS":   [1.70, 1.65, 1.60, 1.55],
    "ADL_BATHING":  [1.90, 1.88, 1.85, 1.80],
}

CE_MEANS  = [14.5, 15.0, 15.8, 16.5]
QOL_MEANS = [13.5, 13.8, 14.2, 14.8]
CE_STD    = 4.5
QOL_STD   = 4.5

AH_MIN_MEANS = [55, 60, 80, 95]
AH_MIN_STD   = 30

WF_HOURS_PPD   = [3.30, 3.40, 3.55, 3.65]
EN_DIRECT_PCT  = [78.0, 80.0, 82.5, 85.0]

LS_LAMBDA = [1.5, 1.2, 1.8, 2.2]


def bernoulli(p):
    return 1 if random.random() < p else 0

def clamp_int(val, lo, hi):
    return max(lo, min(hi, int(round(val))))

def poisson_sample(lam):
    L = math.exp(-lam)
    k = 0
    p = 1.0
    while p > L:
        k += 1
        p *= random.random()
    return k - 1

def normal_clamp(mean, std, lo, hi):
    val = random.gauss(mean, std)
    return clamp_int(val, lo, hi)

def ternary_sample(probs):
    r = random.random()
    if r < probs[0]:
        return 0
    elif r < probs[0] + probs[1]:
        return 1
    else:
        return 2


rows = []
prev_adl_scores = {}

for qi, date in enumerate(DATES):
    wf_hours    = WF_HOURS_PPD[qi]
    wf_adequate = BINARY_PROBS["WF_ADEQUATE"][qi]
    en_direct   = EN_DIRECT_PCT[qi]

    for res in RESIDENTS:
        row = {"Resident_ID": res, "Assessment_Date": date}

        for col, probs in BINARY_PROBS.items():
            if col == "WF_ADEQUATE":
                row[col] = wf_adequate
            else:
                row[col] = bernoulli(probs[qi])

        row["MED_AP"] = ternary_sample(MED_AP_PROBS[qi])

        row["NUM_MEDICATIONS"] = max(0, clamp_int(
            random.gauss(MED_COUNT_MEANS[qi], MED_COUNT_STD), 0, 20
        ))

        adl_total = 0
        for col, means in ADL_MEANS.items():
            score = clamp_int(random.gauss(means[qi], 0.65), 0, 3)
            row[col] = score
            adl_total += score

        row["ADL_CURR_SCORE"] = adl_total
        prev = prev_adl_scores.get(res)
        if prev is not None:
            row["ADL_PREV_SCORE"] = prev
        else:
            row["ADL_PREV_SCORE"] = min(30, adl_total + clamp_int(random.gauss(1.5, 1.0), 0, 4))
        prev_adl_scores[res] = adl_total

        row["CE_01"]  = normal_clamp(CE_MEANS[qi],  CE_STD,  0, 24)
        row["QOL_01"] = normal_clamp(QOL_MEANS[qi], QOL_STD, 0, 24)

        row["AH_MIN"] = max(0, int(random.gauss(AH_MIN_MEANS[qi], AH_MIN_STD)))

        row["WF_HOURS_PPD"]  = round(wf_hours, 2)
        row["EN_DIRECT_PCT"] = round(en_direct, 1)

        row["LS_SESSIONS_QTR"] = poisson_sample(LS_LAMBDA[qi])

        rows.append(row)

COLS = [
    "Resident_ID", "Assessment_Date",
    "PI_01", "PI_S1", "PI_S2", "PI_S3", "PI_S4", "PI_US", "PI_DTI",
    "RP_01", "RP_MECH", "RP_PHYS", "RP_ENV", "RP_SECLUSION",
    "UWL_SIG", "UWL_CON",
    "FALL_01", "FALL_MAJ",
    "MED_POLY", "MED_AP", "NUM_MEDICATIONS",
    "ADL_01", "ADL_PREV_SCORE", "ADL_CURR_SCORE",
    "ADL_BOWEL", "ADL_BLADDER", "ADL_GROOMING", "ADL_TOILET",
    "ADL_FEEDING", "ADL_TRANSFER", "ADL_MOBILITY", "ADL_DRESSING",
    "ADL_STAIRS", "ADL_BATHING",
    "IC_INCONTINENCE", "IC_IAD", "IC_IAD_1A", "IC_IAD_1B", "IC_IAD_2A", "IC_IAD_2B",
    "HOSP_ED", "HOSP_ALL",
    "CE_01",
    "QOL_01",
    "AH_MIN", "AH_REC_RECOMMENDED", "AH_REC_RECEIVED",
    "AH_RCMD_PHYSIO", "AH_RCMD_OT", "AH_RCMD_SPEECH", "AH_RCMD_POD",
    "AH_RCMD_DIET", "AH_RCMD_OTHER", "AH_RCMD_ASSIST",
    "AH_RCVD_PHYSIO", "AH_RCVD_OT", "AH_RCVD_SPEECH", "AH_RCVD_POD",
    "AH_RCVD_DIET", "AH_RCVD_OTHER", "AH_RCVD_ASSIST",
    "WF_HOURS_PPD", "WF_ADEQUATE",
    "EN_DIRECT_PCT",
    "LS_SESSIONS_QTR",
]

out_path = os.path.join(os.path.dirname(__file__), "Synthetic_QI_Data_2023_200r_4q.csv")
out_path = os.path.normpath(out_path)

with open(out_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=COLS)
    writer.writeheader()
    writer.writerows(rows)

print(f"Written {len(rows)} rows to {out_path}")
print(f"Columns ({len(COLS)}): {', '.join(COLS)}")
