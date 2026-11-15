import base64
from typing import Any, cast

from openai import AsyncOpenAI  # long running task

from config import OPENAI_API_KEY

client = AsyncOpenAI(api_key=OPENAI_API_KEY)


async def generate_thumbnail(prompt: str, style_prompt: str, headshot_url: str | None) -> bytes:
    """Use the Responses API with gpt-image-2.6-flare as a built-in image_generation
    tool.
    Pass the headshot URL directly as an input_image when one is provided.
    Returns raw PNG bytes.
    """
    full_prompt = (
        f"{style_prompt}\n\n"
        f"User request: {prompt}\n\n"
        "IMPORTANT: The generated thumbnail MUST prominently feature the person"
        "shown in the provided reference headshot photo. Keep their likeness accurate."
    )

    content: Any = [
        {
            "type": "text",
            "text": full_prompt,
        },
    ]
    if headshot_url:
        content.insert(
            0,
            {
                "type": "input_image",
                "image_url": headshot_url,
            },
        )

    # The installed openai SDK predates typed image_generation params,
    # so the payload is intentionally untyped here.
    input_payload: Any = [
        {
            "role": "user",
            "content": content,
        }
    ]
    tools_payload: Any = [
        {
            "type": "image_generation",
            "model": "gpt-image-2.6-flare",
            "size": "1536x1024",
            "quality": "high",
            "action": "generate",
        }
    ]

    response = await client.responses.create(
        model="gpt-6-luna",
        input=input_payload,
        tools=tools_payload,
    )

    image_output = next(
        (
            cast(Any, item)
            for item in response.output
            if getattr(item, "type", None) == "image_generation_call"
        ),
        None,
    )
    result = getattr(image_output, "result", None)
    if result is None:
        raise RuntimeError("The model did not return a generated image.")

    return base64.b64decode(result)
