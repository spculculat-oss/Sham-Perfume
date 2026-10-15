#!/usr/bin/env python3
"""Configuration settings for the perfume scraper system."""

import os

# Database settings
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = int(os.getenv('DB_PORT', '5432'))
DB_NAME = os.getenv('DB_NAME', 'sham_perfume')
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'postgres')

# Scraper settings
SCRAPER_RATE_LIMIT = float(os.getenv('SCRAPER_RATE_LIMIT', '1.0'))  # seconds between requests
SCRAPER_TIMEOUT = int(os.getenv('SCRAPER_TIMEOUT', '10'))  # request timeout in seconds
MAX_RETRIES = int(os.getenv('MAX_RETRIES', '3'))  # max retries for failed requests

# Logging
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
LOG_FILE = os.getenv('LOG_FILE', 'scraper.log')

# Pricing
PRICE_MARKUP = float(os.getenv('PRICE_MARKUP', '1.5'))  # 50% markup (1.5x)

# Suppliers registry
SUPPLIERS = [
    {
        'name': 'Sham Perfume',
        'website_url': 'https://www.shamperfume.com',
        'api_available': False,
        'status': 'approved',
        'credibility_score': 85,
    },
]
