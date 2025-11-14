"""
Test endpoint for beep functionality during boundary violation testing
"""
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import Boat


@csrf_exempt
def test_beep_for_mfbr(request, mfbr):
    """
    Test endpoint to force beep flag for a specific MFBR number
    Useful for testing ESP32 buzzer functionality
    
    GET /api/test/beep/<mfbr>/ - Check if beep should trigger
    """
    try:
        boat = Boat.objects.filter(mfbr_number=mfbr).first()
        
        if not boat:
            return JsonResponse({
                'beep': False,
                'error': f'Boat with MFBR {mfbr} not found'
            }, status=404)
        
        # For testing, always return beep=True
        return JsonResponse({
            'beep': True,
            'mfbr': mfbr,
            'boat_name': boat.boat_name,
            'message': 'Test beep endpoint - buzzer should activate'
        })
        
    except Exception as e:
        return JsonResponse({
            'beep': False,
            'error': str(e)
        }, status=500)
