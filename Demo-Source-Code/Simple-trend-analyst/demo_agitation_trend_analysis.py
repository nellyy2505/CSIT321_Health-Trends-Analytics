
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import argparse

# ---------- CONFIG ----------
CSV_PATH = "health_observations.csv"  # Change this if needed
MOVING_AVG_WINDOW = 3
# ----------------------------

def load_and_prepare_data(path):
  df = pd.read_csv(path, parse_dates=["date"])
  df = df.sort_values(["resident_id", "date"])
  return df

def add_moving_avg_and_trend(df):
  result = []
  for rid, group in df.groupby("resident_id"):
    group = group.copy()
    group["moving_avg"] = group["agitation_score"].rolling(MOVING_AVG_WINDOW).mean().round(2)

    # Simple trend detection
    trend = ["stable"]
    for i in range(1, len(group)):
      if pd.isna(group.iloc[i]["moving_avg"]) or pd.isna(group.iloc[i-1]["moving_avg"]):
        trend.append("stable")
      elif group.iloc[i]["moving_avg"] > group.iloc[i-1]["moving_avg"]:
        trend.append("rising")
      elif group.iloc[i]["moving_avg"] < group.iloc[i-1]["moving_avg"]:
        trend.append("falling")
      else:
        trend.append("stable")
    group["trend"] = trend
    result.append(group)
  return pd.concat(result)

def plot_trends(df):
  sns.set(style="whitegrid")
  residents = df["resident_id"].unique()
  for rid in residents:
    rdata = df[df["resident_id"] == rid]
    plt.figure(figsize=(10, 5))
    plt.plot(rdata["date"], rdata["agitation_score"], label="Agitation Score", marker="o")
    plt.plot(rdata["date"], rdata["moving_avg"], label=f"{MOVING_AVG_WINDOW}-Day Moving Avg", linestyle="--")
    for i, row in rdata.iterrows():
      if pd.notna(row["intervention_type"]):
        plt.axvline(row["date"], color="red", linestyle=":", alpha=0.7)
        plt.text(row["date"], max(rdata["agitation_score"])+0.5, row["intervention_type"], rotation=90, color="red")
    plt.title(f"Resident {rid} - Agitation Trend")
    plt.xlabel("Date")
    plt.ylabel("Agitation Score")
    plt.legend()
    plt.tight_layout()
    plt.show()

def main():
  df = load_and_prepare_data(CSV_PATH)
  df = add_moving_avg_and_trend(df)
  df.to_csv("agitation_analysis_output.csv", index=False)
  print("Saved analysis to agitation_analysis_output.csv")
  plot_trends(df)

if __name__ == "__main__":
  main()
