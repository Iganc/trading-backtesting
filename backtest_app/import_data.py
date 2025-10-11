import os
import django
import pandas as pd
import glob
from datetime import datetime
import pytz 

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backtesting.settings')
django.setup()

from backtest_app.models import SP500
import kagglehub
from django.db import transaction
from django.db.models import Count

BATCH_SIZE = 5000  
MAX_WORKERS = 4   

def process_batch(batch_data):
    objects_to_create = []
    
    eastern = pytz.timezone('US/Eastern')

    for _, row in batch_data.iterrows():
        date_str = str(row['date']).strip()

        naive_date = datetime.strptime(date_str, "%Y%m%d  %H:%M:%S")

        aware_date = eastern.localize(naive_date)
        
        sp500_obj = SP500(
            date=aware_date,
            open=row['open'],
            high=row['high'], 
            low=row['low'],
            close=row['close'],
            adj_close=row['close'],
            volume=row['volume']
        )
        objects_to_create.append(sp500_obj)
    
    with transaction.atomic():
        SP500.objects.bulk_create(objects_to_create, batch_size=BATCH_SIZE)
    
    return len(objects_to_create)

def process_csv_file(csv_file):
    print(f"Processing {csv_file}...")
    df = pd.read_csv(csv_file)
    print(f"Loaded {len(df)} records from {csv_file}")
    
    total_processed = 0
    
    for i in range(0, len(df), BATCH_SIZE):
        batch = df.iloc[i:i+BATCH_SIZE]
        processed = process_batch(batch)
        total_processed += processed
        
        print(f"Processed batch {i//BATCH_SIZE + 1}/{(len(df)-1)//BATCH_SIZE + 1} - {total_processed}/{len(df)} records")
    
    print(f"Successfully imported {total_processed} records from {csv_file}")
    return total_processed

def main(): 
    print("Downloading dataset")
    path = kagglehub.dataset_download("gratefuldata/intraday-stock-data-1-min-sp-500-200821")
    print("Path to dataset files:", path)
    
    csv_files = glob.glob(os.path.join(path, "*.csv"))
    print(f"Found {len(csv_files)} CSV files")
    
    total_imported = 0
    for csv_file in csv_files:
        imported = process_csv_file(csv_file)
        total_imported += imported

    print(f"\n=== IMPORT COMPLETED ===")
    print(f"Total records imported: {total_imported}")
    print(f"Total records in database: {SP500.objects.count()}")
    
    duplicates = SP500.objects.values('date').annotate(count=Count('date')).filter(count__gt=1).count()
    print(f"Duplicates after import: {duplicates}")

if __name__ == "__main__":
    main()