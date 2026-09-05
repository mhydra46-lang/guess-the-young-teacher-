#this code was made by Injeti Roni Atchut of class X B
import json
from pathlib import Path
#this code was made by Injeti Roni Atchut of class X B
# =====================================================
# CONFIGURATION
# =====================================================

# Folder containing your image files
IMAGES_FOLDER = Path("images")

# Output file used by your JavaScript quiz
OUTPUT_FILE = Path("people.json")

#this code was made by Injeti Roni Atchut of class X B

# Image extensions that will be included
IMAGE_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".avif"
}

#this code was made by Injeti Roni Atchut of class X B

# =====================================================
# GENERATE PEOPLE DATA
# =====================================================

def generate_people_json():
    if not IMAGES_FOLDER.exists():
        print(f'ERROR: The "{IMAGES_FOLDER}" folder does not exist.')
        print("Create an images folder next to this script and put your images inside it.")
        return
    
#this code was made by Injeti Roni Atchut of class X B
    
    people = []

    # Sort the files so the generated JSON is consistent
    image_files = sorted(
        file for file in IMAGES_FOLDER.iterdir()
        if file.is_file() and file.suffix.lower() in IMAGE_EXTENSIONS
    )

    for image_file in image_files:
        # Filename without extension becomes the person's name
        name = image_file.stem

        people.append({
            "name": name,
            "image": image_file.as_posix()
        })

#this code was made by Injeti Roni Atchut of class X B
    
    with OUTPUT_FILE.open("w", encoding="utf-8") as file:
        json.dump(people, file, indent=4, ensure_ascii=False)

    print(f"Done! Found {len(people)} image(s).")
    print(f"Created: {OUTPUT_FILE}")

#this code was made by Injeti Roni Atchut of class X B
    
    for person in people:
        print(f'  {person["name"]} -> {person["image"]}')


if __name__ == "__main__":
    generate_people_json()

#this code was made by Injeti Roni Atchut of class X B
#this code was made by Injeti Roni Atchut of class X B
#this code was made by Injeti Roni Atchut of class X B
#this code was made by Injeti Roni Atchut of class X B
#this code was made by Injeti Roni Atchut of class X B
#this code was made by Injeti Roni Atchut of class X B
#this code was made by Injeti Roni Atchut of class X B
#this code was made by Injeti Roni Atchut of class X B