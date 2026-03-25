"""
Pure-Python voice biomarker feature extraction for Phase 1 MVP.

Extracts basic acoustic features from WAV audio:
- Speech rate proxy (voiced segments per second)
- Pause count and duration
- Energy metrics

Uses only Python stdlib: wave, struct, math. No external dependencies.
"""
import io
import logging
import math
import struct
import wave

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
FRAME_DURATION_MS = 20          # Analysis window size
MIN_PAUSE_DURATION_MS = 300     # Minimum gap to count as a "pause"
ENERGY_FLOOR = 50               # Minimum RMS threshold (avoids near-silence triggering)
ENERGY_RATIO = 0.01             # Adaptive threshold = 1% of peak RMS
MIN_SPEECH_DURATION_S = 2.0     # Reject recordings with <2s of detected speech


def extract_acoustic_features(wav_bytes: bytes) -> dict:
    """
    Extract basic acoustic features from raw WAV bytes.

    Returns dict with:
        duration_s, speech_duration_s, pause_duration_s,
        pause_count, mean_pause_duration_s, speech_rate_proxy,
        mean_energy, energy_std, vocal_fatigue_index
    """
    buf = io.BytesIO(wav_bytes)
    with wave.open(buf, "rb") as wf:
        n_channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        framerate = wf.getframerate()
        n_frames = wf.getnframes()
        raw = wf.readframes(n_frames)

    duration_s = n_frames / framerate if framerate else 0

    # Convert to mono 16-bit signed samples
    samples = _decode_samples(raw, n_channels, sampwidth)
    if not samples:
        return _empty_features(duration_s)

    # Compute per-frame RMS energy
    frame_size = max(1, int(framerate * FRAME_DURATION_MS / 1000))
    energies = []
    for i in range(0, len(samples) - frame_size + 1, frame_size):
        frame = samples[i : i + frame_size]
        rms = math.sqrt(sum(s * s for s in frame) / len(frame))
        energies.append(rms)

    if not energies:
        return _empty_features(duration_s)

    # Adaptive energy threshold
    peak_rms = max(energies)
    threshold = max(ENERGY_FLOOR, peak_rms * ENERGY_RATIO)

    # Label frames: True = speech, False = silence
    labels = [e > threshold for e in energies]

    # Detect pause segments (consecutive silence frames >= MIN_PAUSE_DURATION_MS)
    min_pause_frames = max(1, int(MIN_PAUSE_DURATION_MS / FRAME_DURATION_MS))
    pauses = []
    speech_frames = 0
    silence_run = 0

    for is_speech in labels:
        if not is_speech:
            silence_run += 1
        else:
            if silence_run >= min_pause_frames:
                pauses.append(silence_run)
            silence_run = 0
            speech_frames += 1
    # Trailing silence
    if silence_run >= min_pause_frames:
        pauses.append(silence_run)

    frame_duration_s = FRAME_DURATION_MS / 1000.0
    speech_duration_s = speech_frames * frame_duration_s
    pause_duration_s = sum(pauses) * frame_duration_s
    pause_count = len(pauses)
    mean_pause_duration_s = (pause_duration_s / pause_count) if pause_count else 0.0

    # Speech rate proxy: number of speech-to-silence transitions per second of speech
    # (rough approximation of syllable rate without transcription)
    transitions = 0
    for i in range(1, len(labels)):
        if labels[i - 1] and not labels[i]:
            transitions += 1
    speech_rate_proxy = (transitions / speech_duration_s) if speech_duration_s > 0.5 else 0.0

    # Energy statistics
    speech_energies = [e for e, s in zip(energies, labels) if s]
    mean_energy = (sum(speech_energies) / len(speech_energies)) if speech_energies else 0.0
    energy_std = _std(speech_energies) if len(speech_energies) > 1 else 0.0

    # Vocal fatigue index: ratio of energy in last third vs first third
    if len(speech_energies) >= 6:
        third = len(speech_energies) // 3
        first_third_mean = sum(speech_energies[:third]) / third
        last_third_mean = sum(speech_energies[-third:]) / third
        vocal_fatigue_index = (last_third_mean / first_third_mean) if first_third_mean > 0 else 1.0
    else:
        vocal_fatigue_index = 1.0

    # ---------------------------------------------------------------
    # Phase 2: Enhanced features — pitch, jitter, shimmer, ZCR, spectral
    # All computed with pure Python (no librosa needed)
    # ---------------------------------------------------------------

    # Zero-crossing rate (speech frames only)
    speech_samples = []
    for i, is_speech in enumerate(labels):
        if is_speech:
            start = i * frame_size
            end = min(start + frame_size, len(samples))
            speech_samples.extend(samples[start:end])

    zcr_mean = 0.0
    if len(speech_samples) > 1:
        crossings = sum(
            1 for j in range(1, len(speech_samples))
            if (speech_samples[j - 1] >= 0) != (speech_samples[j] >= 0)
        )
        zcr_mean = round(crossings / len(speech_samples) * framerate, 2)

    # Pitch estimation via autocorrelation (fundamental frequency F0)
    pitch_values = _estimate_pitch_frames(speech_samples, framerate)
    pitch_mean = round(sum(pitch_values) / len(pitch_values), 1) if pitch_values else 0.0
    pitch_std = round(_std(pitch_values), 1) if len(pitch_values) > 1 else 0.0

    # Jitter (pitch period variability) — cycle-to-cycle F0 variation
    jitter_pct = 0.0
    if len(pitch_values) > 1:
        periods = [1.0 / f for f in pitch_values if f > 0]
        if len(periods) > 1:
            diffs = [abs(periods[j] - periods[j - 1]) for j in range(1, len(periods))]
            mean_period = sum(periods) / len(periods)
            if mean_period > 0:
                jitter_pct = round(100.0 * (sum(diffs) / len(diffs)) / mean_period, 3)

    # Shimmer (amplitude variability between consecutive frames)
    shimmer_pct = 0.0
    if len(speech_energies) > 1:
        amp_diffs = [abs(speech_energies[j] - speech_energies[j - 1]) for j in range(1, len(speech_energies))]
        mean_amp = sum(speech_energies) / len(speech_energies)
        if mean_amp > 0:
            shimmer_pct = round(100.0 * (sum(amp_diffs) / len(amp_diffs)) / mean_amp, 3)

    # Spectral centroid approximation (energy-weighted frequency center)
    spectral_centroid = _spectral_centroid(speech_samples, framerate) if len(speech_samples) > 256 else 0.0

    return {
        "duration_s": round(duration_s, 2),
        "speech_duration_s": round(speech_duration_s, 2),
        "pause_duration_s": round(pause_duration_s, 2),
        "pause_count": pause_count,
        "mean_pause_duration_s": round(mean_pause_duration_s, 3),
        "speech_rate_proxy": round(speech_rate_proxy, 2),
        "mean_energy": round(mean_energy, 2),
        "energy_std": round(energy_std, 2),
        "vocal_fatigue_index": round(vocal_fatigue_index, 3),
        # Phase 2 features
        "pitch_mean_hz": pitch_mean,
        "pitch_std_hz": pitch_std,
        "jitter_pct": jitter_pct,
        "shimmer_pct": shimmer_pct,
        "zcr_mean": zcr_mean,
        "spectral_centroid_hz": round(spectral_centroid, 1),
    }


def compare_to_baseline(current: dict, baseline: dict) -> dict:
    """
    Compare current analysis features to baseline.

    Returns dict with percentage changes and alert level.
    """
    changes = {}
    keys = [
        ("speech_rate_proxy", "speech_rate_change_pct"),
        ("mean_pause_duration_s", "pause_duration_change_pct"),
        ("mean_energy", "energy_change_pct"),
        ("pitch_mean_hz", "pitch_change_pct"),
        ("jitter_pct", "jitter_change_pct"),
        ("shimmer_pct", "shimmer_change_pct"),
    ]
    for feat_key, change_key in keys:
        curr = current.get(feat_key, 0)
        base = baseline.get(feat_key, 0)
        changes[change_key] = round(_pct_change(base, curr), 1)

    # Overall deviation: max of absolute changes across primary features
    primary = [abs(changes["speech_rate_change_pct"]),
               abs(changes["pause_duration_change_pct"]),
               abs(changes["energy_change_pct"])]
    # Also factor in pitch changes (weighted lower)
    if changes.get("pitch_change_pct"):
        primary.append(abs(changes["pitch_change_pct"]) * 0.7)
    overall = max(primary) if primary else 0.0

    # Alert level
    if overall > 30:
        alert_level = "red"
    elif overall > 15:
        alert_level = "amber"
    else:
        alert_level = "green"

    changes["overall_deviation_pct"] = round(overall, 1)
    changes["alert_level"] = alert_level
    return changes


def determine_confidence(recording_count: int) -> str:
    """Determine analysis confidence based on number of recordings in baseline."""
    if recording_count >= 4:
        return "high"
    elif recording_count >= 2:
        return "medium"
    return "low"


def generate_narrative(features: dict, risk_scores: dict | None = None, transcript: str | None = None) -> str:
    """Generate a template-based clinical narrative from features, risk scores, and optional transcript."""
    lines = []

    duration = features.get("duration_s", 0)
    speech = features.get("speech_duration_s", 0)
    speech_pct = round(100 * speech / duration, 1) if duration > 0 else 0
    pauses = features.get("pause_count", 0)
    mean_pause = features.get("mean_pause_duration_s", 0)
    fatigue = features.get("vocal_fatigue_index", 1.0)
    pitch = features.get("pitch_mean_hz", 0)
    jitter = features.get("jitter_pct", 0)
    shimmer = features.get("shimmer_pct", 0)

    lines.append(
        f"Recording duration: {duration}s. "
        f"Speech occupied {speech_pct}% of the recording."
    )
    lines.append(
        f"{pauses} pause(s) detected with mean duration {mean_pause:.2f}s."
    )

    # Phase 2 feature commentary
    if pitch > 0:
        lines.append(f"Mean pitch: {pitch:.0f} Hz.")
    if jitter > 3.0:
        lines.append("Elevated jitter detected, suggesting vocal instability or tremor.")
    if shimmer > 5.0:
        lines.append("Elevated shimmer detected, indicating irregular vocal amplitude — possible laryngeal changes.")

    if fatigue < 0.7:
        lines.append(
            "Vocal fatigue detected: energy dropped significantly toward the end of the recording."
        )

    if transcript:
        word_count = len(transcript.split())
        lines.append(f"Transcript: {word_count} words captured.")

    if risk_scores:
        sr_change = risk_scores.get("speech_rate_change_pct", 0)
        pd_change = risk_scores.get("pause_duration_change_pct", 0)
        pitch_change = risk_scores.get("pitch_change_pct", 0)
        alert = risk_scores.get("alert_level", "green")

        lines.append(
            f"Compared to baseline: speech rate changed by {sr_change:+.1f}%, "
            f"pause duration changed by {pd_change:+.1f}%."
        )
        if pitch_change and abs(pitch_change) > 10:
            lines.append(f"Pitch shifted by {pitch_change:+.1f}% from baseline.")

        if alert == "red":
            lines.append(
                "These changes exceed the monitoring threshold. "
                "Clinical review is recommended."
            )
        elif alert == "amber":
            lines.append(
                "These changes warrant continued monitoring. "
                "Consider scheduling a clinical assessment if the trend persists."
            )
        else:
            lines.append("Voice biomarkers are within normal range of baseline.")
    else:
        lines.append(
            "This is the baseline recording. Future recordings will be compared against these values."
        )

    return " ".join(lines)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _decode_samples(raw: bytes, n_channels: int, sampwidth: int) -> list[float]:
    """Decode raw PCM bytes to a list of mono float samples."""
    if sampwidth == 2:
        fmt = f"<{len(raw) // 2}h"  # 16-bit signed little-endian
        all_samples = list(struct.unpack(fmt, raw))
    elif sampwidth == 1:
        all_samples = [s - 128 for s in raw]  # 8-bit unsigned → signed
    elif sampwidth == 4:
        fmt = f"<{len(raw) // 4}i"  # 32-bit signed
        all_samples = [s / 32768.0 for s in struct.unpack(fmt, raw)]
        return _to_mono(all_samples, n_channels)
    else:
        logger.warning("Unsupported sample width: %d", sampwidth)
        return []

    if n_channels > 1:
        all_samples = _to_mono(all_samples, n_channels)
    return [float(s) for s in all_samples]


def _to_mono(samples: list, n_channels: int) -> list:
    """Mix multi-channel audio down to mono by averaging channels."""
    if n_channels <= 1:
        return samples
    mono = []
    for i in range(0, len(samples), n_channels):
        chunk = samples[i : i + n_channels]
        mono.append(sum(chunk) / len(chunk))
    return mono


def _std(values: list[float]) -> float:
    """Standard deviation of a list of floats."""
    n = len(values)
    if n < 2:
        return 0.0
    mean = sum(values) / n
    variance = sum((x - mean) ** 2 for x in values) / (n - 1)
    return math.sqrt(variance)


def _pct_change(baseline: float, current: float) -> float:
    """Percentage change from baseline to current. Returns 0 if baseline is zero."""
    if abs(baseline) < 1e-9:
        return 0.0
    return 100.0 * (current - baseline) / abs(baseline)


def _estimate_pitch_frames(samples: list[float], sr: int, frame_ms: int = 40) -> list[float]:
    """
    Estimate pitch (F0) per frame using autocorrelation.
    Returns list of F0 values in Hz for each frame with detectable pitch.
    Range: 75–500 Hz (covers elderly male/female speech).
    """
    frame_size = int(sr * frame_ms / 1000)
    min_lag = int(sr / 500)  # 500 Hz max pitch
    max_lag = int(sr / 75)   # 75 Hz min pitch
    pitches = []

    for start in range(0, len(samples) - frame_size, frame_size):
        frame = samples[start:start + frame_size]
        # Skip near-silent frames
        rms = math.sqrt(sum(s * s for s in frame) / len(frame))
        if rms < ENERGY_FLOOR:
            continue

        # Autocorrelation
        best_lag = 0
        best_corr = 0.0
        norm = sum(s * s for s in frame)
        if norm < 1e-9:
            continue

        for lag in range(min_lag, min(max_lag, len(frame))):
            corr = sum(frame[j] * frame[j + lag] for j in range(len(frame) - lag))
            corr /= norm
            if corr > best_corr:
                best_corr = corr
                best_lag = lag

        if best_lag > 0 and best_corr > 0.3:
            pitches.append(sr / best_lag)

    return pitches


def _spectral_centroid(samples: list[float], sr: int) -> float:
    """Compute spectral centroid using a simple DFT on the entire speech signal (or a segment)."""
    # Use at most 4096 samples from the middle for efficiency
    n = min(4096, len(samples))
    start = (len(samples) - n) // 2
    seg = samples[start:start + n]

    # Apply Hann window
    windowed = [seg[i] * 0.5 * (1 - math.cos(2 * math.pi * i / (n - 1))) for i in range(n)]

    # Real DFT magnitude (first half)
    half = n // 2
    magnitudes = []
    for k in range(half):
        re = sum(windowed[j] * math.cos(2 * math.pi * k * j / n) for j in range(n))
        im = sum(windowed[j] * math.sin(2 * math.pi * k * j / n) for j in range(n))
        magnitudes.append(math.sqrt(re * re + im * im))

    total_mag = sum(magnitudes)
    if total_mag < 1e-9:
        return 0.0

    freq_per_bin = sr / n
    centroid = sum(magnitudes[k] * k * freq_per_bin for k in range(half)) / total_mag
    return centroid


def _empty_features(duration_s: float) -> dict:
    """Return zeroed feature dict for empty/invalid audio."""
    return {
        "duration_s": round(duration_s, 2),
        "speech_duration_s": 0.0,
        "pause_duration_s": 0.0,
        "pause_count": 0,
        "mean_pause_duration_s": 0.0,
        "speech_rate_proxy": 0.0,
        "mean_energy": 0.0,
        "energy_std": 0.0,
        "vocal_fatigue_index": 1.0,
        "pitch_mean_hz": 0.0,
        "pitch_std_hz": 0.0,
        "jitter_pct": 0.0,
        "shimmer_pct": 0.0,
        "zcr_mean": 0.0,
        "spectral_centroid_hz": 0.0,
    }
