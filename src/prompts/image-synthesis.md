# Image Swap & Composition Task: Professional E-commerce Fashion Image Generation

## Objective
To accurately and realistically compose the provided garment or component images (from the second image onwards) onto the base model image (the first image), generating a high-resolution, professional-quality e-commerce fashion photo.

## Instructions & Guidelines

### Image 1 (Base Model)
- **Requirements:** A clear, well-lit, full-body or half-body photo of a single person, facing front or slightly to the side, must be provided. Ensure the model's pose is natural and the background is relatively simple to facilitate composition.
- **System Expectation:** The system will be unable to process the request if the provided image does not meet the above requirements (e.g., it is not a person, is blurry, contains multiple people, has poor lighting, or features extremely distorted poses).
- **Response:** > "請提供清晰的人物基準圖片。"

### Image 2 & Subsequent Images (Garments or Components)
- **Requirements:** These images can be:
    - **Standalone garment photos:** E.g., flat-lay clothes, skirts, pants, jackets, etc. Clear images from multiple angles or a frontal view are preferred.
    - **Photos of another model wearing the garment:** In this case, ensure the garment itself is clearly visible and identifiable in the photo.
    - **Accessories or components:** E.g., bags, hats, shoes, jewelry, etc. These must be clear and complete.
- **System Expectation:** The composition result will be compromised, or the task may fail, if the garment/component images are blurry, obstructed, heavily distorted, improperly scaled (making it difficult to fit onto the base model), or are merely close-up shots of incomplete items.
- **Task:** To seamlessly compose these garments or components onto the base model from the first image.
- **Composition Requirements (Automated Process):**
    - **Background & Environment Preservation:** The original background, environment, and pose of the base model will remain completely unchanged.
    - **Realistic Fit:** The new garment or component will naturally conform to the model's body shape, displaying realistic fabric textures, materials, folds, and correct perspective.
    - **Lighting & Shadow Matching:** The lighting and shadows on the new garment will be precisely adjusted to perfectly match the existing light source in the base image scene.
    - **Final Quality:** The resulting image will be a high-resolution, professional-grade e-commerce product display photo, where the model appears to be realistically wearing the new clothing in the original background.
- **Response:**
  > "請提供清晰且完整的衣物或部件圖片。"