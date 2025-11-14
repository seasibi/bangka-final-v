"""
SMS Notification Service for Bangka Tracking System
Supports multiple Philippines SMS providers without requiring physical SIM cards
"""

import requests
import json
import logging
from django.conf import settings
from typing import Optional, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class SMSServiceError(Exception):
    """Custom exception for SMS service errors"""
    pass


class SMSService:
    """
    SMS Service supporting multiple Philippines providers
    Configure in Django settings.py
    """
    
    def __init__(self):
        self.provider = getattr(settings, 'SMS_PROVIDER', 'semaphore')
        # Primary API key (generic for some providers)
        self.api_key = getattr(settings, 'SMS_API_KEY', None)
        self.sender_name = getattr(settings, 'SMS_SENDER_NAME', 'BirukBilug')
        # Vonage-specific credentials
        self.vonage_api_key = getattr(settings, 'VONAGE_API_KEY', None)
        self.vonage_api_secret = getattr(settings, 'VONAGE_API_SECRET', None)
        self.vonage_sender_name = getattr(settings, 'VONAGE_SENDER_NAME', self.sender_name)
        
    def send_sms(self, phone_number: str, message: str) -> Dict[str, Any]:
        """
        Send SMS using configured provider
        
        Args:
            phone_number (str): Philippine mobile number (09XXXXXXXXX or +639XXXXXXXXX)
            message (str): SMS message content
            
        Returns:
            Dict containing success status and response details
        """
        # Validate minimal configuration per provider
        provider = str(self.provider).lower()
        if provider in ('semaphore', 'itexmo'):
            if not self.api_key:
                logger.error("SMS API key not configured")
                raise SMSServiceError("SMS service not configured. Please set SMS_API_KEY in settings.")
        elif provider == 'vonage':
            if not (self.vonage_api_key and self.vonage_api_secret):
                logger.error("Vonage API credentials not configured")
                raise SMSServiceError("SMS service not configured. Please set VONAGE_API_KEY and VONAGE_API_SECRET in settings.")
        else:
            raise SMSServiceError(f"Unsupported SMS provider: {self.provider}")
        
        # Normalize phone number to Philippine format
        normalized_number = self._normalize_phone_number(phone_number)
        
        try:
            if provider == 'semaphore':
                return self._send_semaphore_sms(normalized_number, message)
            elif provider == 'itexmo':
                return self._send_itexmo_sms(normalized_number, message)
            elif provider == 'vonage':
                return self._send_vonage_sms(normalized_number, message)
            else:
                raise SMSServiceError(f"Unsupported SMS provider: {self.provider}")
                
        except Exception as e:
            logger.error(f"SMS sending failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'provider': self.provider,
                'timestamp': datetime.now().isoformat()
            }
    
    def _normalize_phone_number(self, phone_number: str) -> str:
        """
        Normalize Philippine phone numbers
        Converts various formats to +639XXXXXXXXX
        """
        # Remove all non-numeric characters except +
        clean_number = ''.join(c for c in phone_number if c.isdigit() or c == '+')
        
        # Handle different formats
        if clean_number.startswith('+639'):
            return clean_number
        elif clean_number.startswith('639'):
            return '+' + clean_number
        elif clean_number.startswith('09'):
            return '+63' + clean_number[1:]
        elif clean_number.startswith('9') and len(clean_number) == 10:
            return '+63' + clean_number
        else:
            # If format is unrecognized, assume it's already correct
            return phone_number
    
    def _send_semaphore_sms(self, phone_number: str, message: str) -> Dict[str, Any]:
        """Send SMS via Semaphore API (Philippines)"""
        url = "https://api.semaphore.co/api/v4/messages"
        
        # Use configured/approved sender name if provided
        sender = (self.sender_name or '').strip()
        
        payload = {
            'apikey': self.api_key,
            'number': phone_number,
            'message': message,
        }
        if sender:
            payload['sendername'] = sender
        
        response = requests.post(url, data=payload, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        # Semaphore returns a list of message results; handle both list/dict
        data = result[0] if isinstance(result, list) and result else (result if isinstance(result, dict) else {})
        
        success = False
        status = str(data.get('status', '')).lower()
        code = data.get('status_code')
        # Treat accepted/queued states as success (message accepted by provider)
        if status in ('queued', 'sent', 'success', 'pending', 'accepted') or code in (0, '0') or data.get('message_id'):
            success = True
        
        return {
            'success': success,
            'provider': 'semaphore',
            'message_id': data.get('message_id') or data.get('id'),
            'response': result,
            'timestamp': datetime.now().isoformat()
        }
    
    def _send_itexmo_sms(self, phone_number: str, message: str) -> Dict[str, Any]:
        """Send SMS via ITEXMO API (Philippines)"""
        url = "https://www.itexmo.com/php_api/api.php"
        
        payload = {
            '1': phone_number,
            '2': message,
            '3': self.api_key,
            'passwd': getattr(settings, 'SMS_API_PASSWORD', ''),  # ITEXMO requires password
        }
        
        response = requests.post(url, data=payload, timeout=30)
        response_text = response.text.strip()
        
        # ITEXMO returns "0" for success, error code for failure
        success = response_text == "0"
        
        return {
            'success': success,
            'provider': 'itexmo',
            'response_code': response_text,
            'response': {'code': response_text, 'success': success},
            'timestamp': datetime.now().isoformat()
        }
    
    def _send_vonage_sms(self, phone_number: str, message: str) -> Dict[str, Any]:
        """Send SMS via Vonage (Nexmo) SMS API"""
        url = "https://rest.nexmo.com/sms/json"

        # Vonage expects E.164; allow '+' or not. Strip leading '+' for safety
        to_number = phone_number.lstrip('+') if isinstance(phone_number, str) else phone_number

        sender = (self.vonage_sender_name or self.sender_name or 'BANGKA').strip()[:11]
        payload = {
            'api_key': self.vonage_api_key,
            'api_secret': self.vonage_api_secret,
            'to': to_number,
            'from': sender,
            'text': message,
            'type': 'text',
        }

        response = requests.post(url, data=payload, timeout=30)
        response.raise_for_status()
        result = response.json()

        messages = result.get('messages', []) if isinstance(result, dict) else []
        first = messages[0] if messages else {}
        status = str(first.get('status', ''))
        success = status == '0'

        return {
            'success': success,
            'provider': 'vonage',
            'message_id': first.get('message-id'),
            'response': result,
            'timestamp': datetime.now().isoformat()
        }


# Convenience function for easy usage
def send_boundary_crossing_sms(phone_number: str, fisherfolk_name: str, 
                              from_municipality: str, to_municipality: str,
                              boat_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Send boundary crossing notification SMS
    
    Args:
        phone_number (str): Fisherfolk's mobile number
        fisherfolk_name (str): Name of the fisherfolk/owner
        from_municipality (str): Municipality they left
        to_municipality (str): Municipality they entered
        boat_name (Optional[str]): Boat name to include in the message
    
    Returns:
        Dict containing SMS sending result
    """
    sms_service = SMSService()
    
    boat_label = (boat_name or 'the boat').strip()
    owner_label = (fisherfolk_name or 'the owner').strip()
    message = (
        "BOUNDARY ALERT: Hello, this is to inform you that the boat, "
        f"{boat_label}, registered under {owner_label} has crossed from {from_municipality} to {to_municipality}. "
        f"Because of this, {owner_label} is subject to questioning to determine the reason for crossing the boundary.\n\n"
        "Please ensure that the boat has the proper permits for fishing in this area. "
        f"Kindly remind {owner_label} of this violation as soon as they arrive. Thank you and safe sailing!\n"
        "– BANGKA"
    )
    
    return sms_service.send_sms(phone_number, message)


def send_emergency_sms(phone_number: str, boat_id: str, location: str) -> Dict[str, Any]:
    """
    Send emergency notification SMS
    
    Args:
        phone_number (str): Emergency contact number
        boat_id (str): ID of the boat in distress
        location (str): Current location of the boat
    
    Returns:
        Dict containing SMS sending result
    """
    sms_service = SMSService()
    
    message = (
        f"EMERGENCY ALERT: Boat {boat_id} may need assistance! "
        f"Last known location: {location}. "
        f"Please verify boat status immediately. "
        f"- BirukBilug Emergency System"
    )
    
    return sms_service.send_sms(phone_number, message)