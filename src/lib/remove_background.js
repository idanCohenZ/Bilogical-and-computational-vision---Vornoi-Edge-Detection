import requests
import sys
import os
from pathlib import Path



API_KEY = os.environ.get("REMOVEBG_API_KEY", "A1EsmfQDeJr4ypTy4omZ8A8q")
API_URL = "https://api.remove.bg/v1.0/removebg"

VALID_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.heic'}


def remove_background(input_path: str, output_path: str = None) -> str:

    input_file = Path(input_path)
    
    # Validate input file exists
    if not input_file.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")
    
    # Validate file extension
    if input_file.suffix.lower() not in VALID_EXTENSIONS:
        raise ValueError(f"Invalid file type. Supported formats: {', '.join(VALID_EXTENSIONS)}")
    
    # Generate output path if not provided
    if output_path is None:
        output_path = input_file.parent / f"{input_file.stem}_no_bg.png"
    
    # Check API key
    if API_KEY == "YOUR_API_KEY_HERE":
        raise ValueError(
            "Please set your remove.bg API key!\n"
            "Get your free API key at: https://www.remove.bg/dashboard#api-key\n"
            "Then either:\n"
            "  1. Set environment variable: export REMOVEBG_API_KEY='your_key'\n"
            "  2. Or replace 'YOUR_API_KEY_HERE' in this script"
        )
    
    print(f"Processing: {input_path}")
    
    # Make API request
    with open(input_path, 'rb') as image_file:
        response = requests.post(
            API_URL,
            files={'image_file': image_file},
            data={'size': 'auto'},
            headers={'X-Api-Key': API_KEY}
        )
    
    # Handle response
    if response.status_code == 200:
        # Save the result
        with open(output_path, 'wb') as output_file:
            output_file.write(response.content)
        print(f"✓ Saved to: {output_path}")
        return str(output_path)
    else:
        # Handle errors
        print(f"Response status: {response.status_code}")
        print(f"Response: {response.text}")
        try:
            error_info = response.json()
            errors = error_info.get('errors', [])
            error_message = errors[0].get('title', 'Unknown error') if errors else f"HTTP {response.status_code}"
        except:
            error_message = f"HTTP {response.status_code}"
        raise Exception(f"API Error: {error_message}")


def process_directory(input_dir: str, output_dir: str = None) -> dict:
 
    input_path = Path(input_dir)
    
    if not input_path.exists():
        raise FileNotFoundError(f"Directory not found: {input_dir}")
    
    if not input_path.is_dir():
        raise ValueError(f"Not a directory: {input_dir}")
    
    # Set output directory
    if output_dir:
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
    else:
        output_path = input_path
    
    # Find all valid images
    images = [f for f in input_path.iterdir() 
              if f.is_file() and f.suffix.lower() in VALID_EXTENSIONS
              and not f.stem.endswith('_no_bg')]  # Skip already processed
    
    if not images:
        print(f"No images found in {input_dir}")
        print(f"Supported formats: {', '.join(VALID_EXTENSIONS)}")
        return {'success': 0, 'failed': 0, 'total': 0}
    
    print(f"Found {len(images)} images to process")
    print("-" * 50)
    
    results = {'success': 0, 'failed': 0, 'total': len(images), 'errors': []}
    
    for i, image in enumerate(images, 1):
        print(f"\n[{i}/{len(images)}] ", end="")
        
        output_file = output_path / f"{image.stem}_no_bg.png"
        
        try:
            remove_background(str(image), str(output_file))
            results['success'] += 1
        except Exception as e:
            print(f"✗ Failed: {e}")
            results['failed'] += 1
            results['errors'].append({'file': str(image), 'error': str(e)})
    
    # Print summary
    print("\n" + "=" * 50)
    print("BATCH PROCESSING COMPLETE")
    print("=" * 50)
    print(f"✓ Success: {results['success']}/{results['total']}")
    if results['failed'] > 0:
        print(f"✗ Failed: {results['failed']}/{results['total']}")
    print(f"Output directory: {output_path}")
    
    return results


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    
    # Check for directory mode
    if sys.argv[1] == '--dir':
        if len(sys.argv) < 3:
            print("Error: Please provide an input directory")
            print("\nUsage: python remove_background.py --dir <input_directory> [output_directory]")
            sys.exit(1)
        
        input_dir = sys.argv[2]
        output_dir = sys.argv[3] if len(sys.argv) > 3 else None
        
        try:
            process_directory(input_dir, output_dir)
        except Exception as e:
            print(f"Error: {e}")
            sys.exit(1)
    else:
        # Single image mode
        input_path = sys.argv[1]
        output_path = sys.argv[2] if len(sys.argv) > 2 else None
        
        try:
            remove_background(input_path, output_path)
        except FileNotFoundError as e:
            print(f"Error: {e}")
            sys.exit(1)
        except ValueError as e:
            print(f"Error: {e}")
            sys.exit(1)
        except Exception as e:
            print(f"Error: {e}")
            sys.exit(1)


if __name__ == "__main__":
    main()
