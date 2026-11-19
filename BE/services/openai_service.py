import base64
import json
from typing import Any

from openai import AsyncOpenAI
from openai.types.responses import ResponseInputImageParam, ResponseInputTextParam

from config import OPENAI_API_KEY

client = AsyncOpenAI(api_key=OPENAI_API_KEY)

# The Responses API names content parts after the direction of travel: what you
# send the model is "input_text" / "input_image", what it sends back is
# "output_text". Plain "text" only belongs in the output, and the API rejects it
# with a 400 invalid_value error.
IMAGE_MODEL = "gpt-image-2.6-flare"
TEXT_MODEL = "gpt-6-luna"


async def generate_thumbnail(
    prompt: str, style_prompt: str, headshot_url: str | None
) -> bytes:
    """Ask the model to draw a thumbnail with the built-in image_generation tool.

    The headshot URL, when present, goes in as an input_image so the model works
    from the real photo instead of inventing a face. Returns raw PNG bytes.
    """
    full_prompt = f"{style_prompt}\n\nUser request: {prompt}"

    if headshot_url:
        full_prompt += (
            "\n\nUse the attached reference photo of the person. Preserve their "
            "facial features, hair and identity exactly, and build the thumbnail "
            "around them. This is an edit of that photo, not a new invented face."
        )

    content: list[ResponseInputTextParam | ResponseInputImageParam] = []
    if headshot_url:
        content.append(
            {
                "type": "input_image",
                "image_url": headshot_url,
                "detail": "auto",
            }
        )
    content.append({"type": "input_text", "text": full_prompt})

    input_payload: Any = [{"role": "user", "content": content}]

    # The installed SDK (1.78) has no typed image_generation tool yet, so the
    # tool payload is intentionally untyped.
    tools_payload: Any = [
        {
            "type": "image_generation",
            "model": IMAGE_MODEL,
            "size": "1536x1024",
            "quality": "high",
            # "generate" makes the image model ignore images in context and
            # invent a fresh scene. "edit" makes it use the reference headshot.
            "action": "edit" if headshot_url else "generate",
        }
    ]

    raw_response = await client.responses.with_raw_response.create(
        model=TEXT_MODEL,
        input=input_payload,
        tools=tools_payload,
    )

    # Read the JSON directly instead of going through the SDK's construct_type().
    # openai 1.78 caches discriminated-union metadata by setting an attribute on
    # typing.Union, which Python 3.14 forbids. Keeping the raw path means no SDK
    # upgrade is needed here.
    payload: Any = json.loads(raw_response.content)

    image_output = next(
        (
            item
            for item in payload.get("output", [])
            if item.get("type") == "image_generation_call"
        ),
        None,
    )
    result = image_output.get("result") if image_output else None
    if not result:
        raise RuntimeError("The model did not return a generated image.")

    return base64.b64decode(result)
