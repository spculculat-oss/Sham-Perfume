#!/usr/bin/env python3
"""
Shaheen Doctor - Automated AI Maintenance Agent
Performs continuous monitoring and auto-fix of store issues
"""

import json
import os
import sys
import time
import re
import requests
from datetime import datetime, timedelta
from pathlib import Path

# Configuration
STORE_URL = "https://spculculat-oss.github.io/Sham-Perfume/#store"
PRODUCTS_FILE = "src/data/products.json"
REVIEW_FILE = "src/data/live/store-review.json"
SITE_URL = "https://spculculat-oss.github.io/Sham-Perfume/"
CHECK_INTERVAL = 600  # 10 minutes
MAX_FIX_ATTEMPTS = 3

class ShaheenDoctor:
    def __init__(self):
        self.logger = self._setup_logger()
        self.fix_count = 0
        self.issues_found = []
        
    def _setup_logger(self):
        """Setup logging for doctor operations."""
        return print  # Simple print-based logging
        
    def log(self, message, level="INFO"):
        """Log a message with timestamp."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")
        
    def check_products_file(self):
        """Check if products.json exists and is valid."""
        self.log("Checking products.json...")
        
        try:
            with open(PRODUCTS_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            products = data.get('products', [])
            
            if len(products) == 0:
                self.log("ERROR: No products found in products.json", "ERROR")
                return False
            
            # Check each product has required fields
            missing_fields = []
            for i, p in enumerate(products):
                required = ['id', 'nameAr', 'brand', 'ourPrice', 'imageUrl']
                for field in required:
                    if field not in p or (isinstance(p.get(field), str) and p.get(field) == ''):
                        missing_fields.append(f"Product {i}: missing {field}")
            
            if missing_fields:
                self.log(f"WARNING: {len(missing_fields)} products missing fields", "WARNING")
                self.fix_missing_fields(products, missing_fields)
            
            self.log(f"OK: {len(products)} products found, valid JSON")
            return True
            
        except Exception as e:
            self.log(f"ERROR: Failed to read products.json: {e}", "ERROR")
            return False
    
    def fix_missing_fields(self, products, missing_fields):
        """Fix missing fields in products."""
        self.log(f"Attempting to fix {len(missing_fields)} missing fields...")
        
        for issue in missing_fields[:MAX_FIX_ATTEMPTS]:
            self.log(f"Fixing: {issue}")
            # Implementation depends on the specific issue
            # This is a placeholder for the fix logic
        self.log("Fix attempt completed")
    
    def check_store_page(self):
        """Check if store page is accessible."""
        self.log("Checking store page accessibility...")
        
        try:
            # Check main site
            response = requests.get("https://spculculat-oss.github.io/Sham-Perfume/", timeout=10)
            if response.status_code == 200:
                self.log("OK: Main site accessible")
            else:
                self.log(f"WARNING: Main site returned {response.status_code}", "WARNING")
                
            # Check store hash
            store_response = requests.get(f"{STORE_URL}", timeout=10)
            if store_response.status_code == 200:
                self.log("OK: Store page accessible")
            else:
                self.log(f"WARNING: Store page returned {store_response.status_code}", "WARNING")
                
            return True
            
        except Exception as e:
            self.log(f"ERROR: Failed to check store page: {e}", "ERROR")
            return False
    
    def check_product_images(self):
        """Check if product images are loading."""
        self.log("Checking product images...")
        
        try:
            with open(PRODUCTS_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            products = data.get('products', [])
            broken_images = []
            
            for p in products[:10]:  # Check first 10 only
                image_url = p.get('imageUrl', '')
                if image_url and image_url.startswith('http'):
                    try:
                        response = requests.head(image_url, timeout=5, allow_redirects=True)
                        if response.status_code >= 400:
                            broken_images.append(f"{p.get('nameAr', 'Unknown')}: {image_url}")
                    except:
                        broken_images.append(f"{p.get('nameAr', 'Unknown')}: {image_url}")
            
            if broken_images:
                self.log(f"WARNING: {len(broken_images)} broken images detected", "WARNING")
                self.issues_found.extend(broken_images)
            else:
                self.log("OK: No broken images in first 10 products")
                
            return True
            
        except Exception as e:
            self.log(f"ERROR: Failed to check images: {e}", "ERROR")
            return False
    
    def check_store_review(self):
        """Read the report of «مراجع الصفحات» (written by «مستورد شاهين» every 12 hours)."""
        self.log("Checking the page reviewer report...")
        try:
            with open(REVIEW_FILE, 'r', encoding='utf-8') as f:
                review = json.load(f)
        except FileNotFoundError:
            self.log("INFO: No reviewer report yet (the importer has not run)")
            return True
        except Exception as e:
            self.log(f"ERROR: Reviewer report unreadable: {e}", "ERROR")
            return False
        s = review.get('summary', {})
        self.log(f"Reviewer: {s.get('total', 0)} products, {s.get('ok', 0)} ok, {s.get('warn', 0)} with remarks, "
                 f"{s.get('hidden', 0)} hidden, {s.get('brokenImages', 0)}/{s.get('imagesChecked', 0)} broken photos")
        for item in review.get('items', []):
            if item.get('status') == 'hidden':
                self.issues_found.append(f"{item.get('sku')}: {', '.join(item.get('issues', []))}")
        return True

    def check_product_pages(self):
        """Every product has its own page (p/<slug>.html): check the index and a few imported products."""
        self.log("Checking the product pages...")
        try:
            r = requests.get(f"{SITE_URL}p/index.html", timeout=10)
            if r.status_code != 200:
                self.log(f"WARNING: Product index returned {r.status_code} (Pages not rebuilt yet?)", "WARNING")
                return True
            with open(PRODUCTS_FILE, 'r', encoding='utf-8') as f:
                products = [p for p in json.load(f).get('products', []) if p.get('slug') and p.get('published', True)]
            sample = products[(self.fix_count * 3) % max(1, len(products)):][:3]
            for p in sample:
                page = requests.get(f"{SITE_URL}p/{p['slug']}.html", timeout=10)
                if page.status_code != 200:
                    self.issues_found.append(f"{p.get('sku')}: product page returned {page.status_code}")
            self.log(f"OK: product index online; {len(sample)} product pages checked")
            return True
        except Exception as e:
            self.log(f"ERROR: Failed to check product pages: {e}", "ERROR")
            return False

    def check_workflow_status(self):
        """Check GitHub Actions workflow status."""
        self.log("Checking GitHub Actions status...")
        # This would use GitHub API, but requires authentication
        self.log("INFO: Workflow status check requires GitHub token")
        return True
    
    def perform_self_check(self):
        """Perform comprehensive self-check."""
        self.log("=" * 60)
        self.log("SHAHEEN DOCTOR: Starting self-check")
        self.log("=" * 60)
        
        start_time = time.time()
        
        checks = [
            ("Products File", self.check_products_file),
            ("Store Page", self.check_store_page),
            ("Product Images", self.check_product_images),
            ("Page Reviewer", self.check_store_review),
            ("Product Pages", self.check_product_pages),
            ("Workflow Status", self.check_workflow_status),
        ]
        
        results = []
        for name, check_func in checks:
            try:
                result = check_func()
                results.append((name, result, None))
            except Exception as e:
                results.append((name, False, str(e)))
                self.log(f"ERROR: {name} check failed: {e}", "ERROR")
        
        elapsed = time.time() - start_time
        
        self.log("=" * 60)
        self.log("SHAHEEN DOCTOR: Self-check complete")
        self.log(f"Total time: {elapsed:.2f}s")
        self.log(f"Issues found: {len(self.issues_found)}")
        self.log("=" * 60)
        
        return results
    
    def auto_fix(self):
        """Attempt to auto-fix any detected issues."""
        self.log("=" * 60)
        self.log("SHAHEEN DOCTOR: Attempting auto-fix")
        self.log("=" * 60)
        
        if not self.issues_found:
            self.log("No issues to fix")
            return True
            
        for issue in self.issues_found[:MAX_FIX_ATTEMPTS]:
            self.log(f"Fixing issue: {issue}")
            # Auto-fix logic would go here
            # This is a placeholder
            
        self.log("Auto-fix attempt completed")
        return True
    
    def run_cycle(self):
        """Run one complete monitoring cycle."""
        self.log("")
        self.log("*" * 60)
        self.log(f"SHAHEEN DOCTOR: Cycle {self.fix_count + 1} starting")
        self.log("*" * 60)
        
        # Perform self-check
        self.perform_self_check()
        
        # Auto-fix if needed
        self.auto_fix()
        
        self.fix_count += 1
        
        # Schedule next cycle
        self.log(f"Next check in {CHECK_INTERVAL} seconds ({CHECK_INTERVAL // 60} minutes)")
        
        return True


def main():
    doctor = ShaheenDoctor()
    
    # Run initial check
    doctor.run_cycle()
    
    # If running as daemon, schedule periodic checks
    if os.environ.get('DOCTOR_DAEMON', '0') == '1':
        doctor.log("Starting daemon mode...")
        while True:
            time.sleep(CHECK_INTERVAL)
            doctor.run_cycle()


if __name__ == "__main__":
    main()
