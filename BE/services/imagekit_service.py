from typing import Optional

from imagekitio import ImageKit

from config import IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT

imagekit = ImageKit(private_key=IMAGEKIT_PRIVATE_KEY)

def upload_image(file_path: str, file_name: str, folder: str, content_type: str = "image/png") -> str | None:
    """
    Uploads an image to ImageKit and returns the CDN URL of the uploaded image.
    """
    result = imagekit.files.upload(
        file=(file_path, file_name, content_type),
        file_name=file_name,
        folder=folder,
        is_private_file=False,
        use_unique_file_name=True
    )

    return result.url
