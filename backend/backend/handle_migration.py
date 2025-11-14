#!/usr/bin/env python
import sys
import subprocess
from unittest.mock import patch
import io

def run_makemigrations_with_default():
    """
    Run makemigrations and automatically provide default values for new fields
    """
    # Simulate user input for the migration question
    inputs = ["1", "'N/A'", "1", "'N/A'"]  # Option 1, default value 'N/A'
    input_generator = iter(inputs)
    
    def mock_input(prompt=""):
        try:
            response = next(input_generator)
            print(f"{prompt}{response}")
            return response
        except StopIteration:
            return "1"  # Default to option 1 if we run out of inputs
    
    # Patch the input function and run makemigrations
    with patch('builtins.input', mock_input):
        try:
            result = subprocess.run(
                [sys.executable, 'manage.py', 'makemigrations'],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            print("STDOUT:", result.stdout)
            if result.stderr:
                print("STDERR:", result.stderr)
            
            return result.returncode == 0
            
        except subprocess.TimeoutExpired:
            print("Migration command timed out")
            return False
        except Exception as e:
            print(f"Error running migration: {e}")
            return False

if __name__ == "__main__":
    success = run_makemigrations_with_default()
    if success:
        print("Migration created successfully!")
    else:
        print("Migration failed!")