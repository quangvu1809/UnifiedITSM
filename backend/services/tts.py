import io
import re
import base64
import torch
import logging
import soundfile as sf
import numpy as np
from pathlib import Path
from typing import Optional, Tuple, Dict
from transformers import VitsModel, AutoTokenizer
from config import get_settings

logger = logging.getLogger(__name__)

# Lazy-loaded models
_tts_models: Dict[str, dict] = {}

VIETNAMESE_DIACRITICS = re.compile(
    r"[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]",
    re.IGNORECASE,
)

def detect_language(text: str) -> str:
    """Detect if text is Vietnamese or English based on diacritics."""
    matches = VIETNAMESE_DIACRITICS.findall(text)
    if len(matches) > 3:
        return "vie"
    return "eng"

def load_tts_models():
    """Load TTS models for English and Vietnamese."""
    global _tts_models
    settings = get_settings()
    
    if not _tts_models:
        try:
            logger.info("Loading English TTS model...")
            _tts_models["eng"] = {
                "model": VitsModel.from_pretrained(settings.TTS_MODEL_ENG),
                "tokenizer": AutoTokenizer.from_pretrained(settings.TTS_MODEL_ENG),
            }
            logger.info("Loading Vietnamese TTS model...")
            _tts_models["vie"] = {
                "model": VitsModel.from_pretrained(settings.TTS_MODEL_VIE),
                "tokenizer": AutoTokenizer.from_pretrained(settings.TTS_MODEL_VIE),
            }
            logger.info("TTS models loaded successfully.")
        except Exception as e:
            logger.error(f"TTS model loading failed: {e}")
    return _tts_models

def generate_speech(text: str, lang: Optional[str] = None) -> Tuple[str, str]:
    """Convert text to speech, return (base64_wav, lang_code)."""
    models = load_tts_models()
    if not models:
        return "", ""

    if lang and lang in models:
        target_lang = lang
    else:
        target_lang = detect_language(text)

    if target_lang not in models:
        target_lang = "eng"

    model_data = models[target_lang]
    model = model_data["model"]
    tokenizer = model_data["tokenizer"]

    # Truncate long text for TTS
    tts_text = text[:500] if len(text) > 500 else text

    try:
        inputs = tokenizer(tts_text, return_tensors="pt")
        with torch.no_grad():
            output = model(**inputs)

        waveform = output.waveform[0].cpu().numpy()

        buf = io.BytesIO()
        sf.write(buf, waveform, model.config.sampling_rate, format="WAV")
        buf.seek(0)
        audio_b64 = base64.b64encode(buf.read()).decode("utf-8")

        return audio_b64, target_lang
    except Exception as e:
        logger.error(f"Speech generation failed: {e}")
        return "", target_lang
