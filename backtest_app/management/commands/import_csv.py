import csv
import os
from datetime import datetime
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.timezone import make_aware
from backtest_app.models import TimeSeriesData

class Command(BaseCommand):
    help = 'Importuje dane continuous contract z pliku CSV do bazy danych'

    def add_arguments(self, parser):
        parser.add_argument('csv_file', type=str, help='Ścieżka do pliku CSV')
        parser.add_argument('--symbol', type=str, help='Symbol dla wszystkich rekordów (opcjonalnie)')
        parser.add_argument('--batch-size', type=int, default=5000, help='Rozmiar paczki dla bulk_create')
        parser.add_argument('--delete-existing', action='store_true', help='Usuń istniejące dane dla tego symbolu')

    def handle(self, *args, **options):
        csv_file = options['csv_file']
        batch_size = options['batch_size']
        symbol_override = options.get('symbol')
        delete_existing = options.get('delete_existing', False)

        if not os.path.exists(csv_file):
            self.stderr.write(self.style.ERROR(f"Plik {csv_file} nie istnieje"))
            return

        # Pobranie symbolu z nazwy pliku, jeśli nie podano
        if not symbol_override:
            filename = os.path.basename(csv_file)
            if 'es_' in filename.lower():
                symbol = 'ES.v.0'
            elif 'nq_' in filename.lower():
                symbol = 'NQ.v.0'
            else:
                self.stderr.write(self.style.WARNING("Nie rozpoznano symbolu z nazwy pliku. Użyj --symbol aby określić symbol."))
                return
        else:
            symbol = symbol_override

        # Usuwanie istniejących danych dla danego symbolu
        if delete_existing:
            deleted_count = TimeSeriesData.objects.filter(symbol=symbol).delete()[0]
            self.stdout.write(self.style.WARNING(f"Usunięto {deleted_count} istniejących rekordów dla symbolu {symbol}"))

        # Import danych
        records_created = 0
        batch = []
        
        with open(csv_file, 'r') as f:
            reader = csv.DictReader(f)
            total_rows = sum(1 for _ in open(csv_file)) - 1  # -1 dla nagłówka
            
            for i, row in enumerate(reader):
                if i % 100000 == 0 and i > 0:
                    self.stdout.write(f"Przetworzono {i}/{total_rows} wierszy ({(i/total_rows)*100:.1f}%)")
                
                # Tworzenie obiektu modelu
                try:
                    # Konwersja timestamp do formatu Django
                    timestamp = make_aware(datetime.fromisoformat(row['ts_event'].replace('+00:00', '').replace('Z', '')))
                    
                    # Tworzenie rekordu wykorzystując istniejący model TimeSeriesData
                    data_point = TimeSeriesData(
                        symbol=row['symbol'] if 'symbol' in row else symbol,
                        date=timestamp,
                        open=float(row['open']),
                        high=float(row['high']),
                        low=float(row['low']),
                        close=float(row['close']),
                        volume=int(row['volume'])
                    )
                    batch.append(data_point)
                    
                    # Zapisywanie w paczkach dla lepszej wydajności
                    if len(batch) >= batch_size:
                        with transaction.atomic():
                            TimeSeriesData.objects.bulk_create(batch, ignore_conflicts=True)
                        records_created += len(batch)
                        batch = []
                        
                except Exception as e:
                    self.stderr.write(self.style.ERROR(f"Błąd w wierszu {i+1}: {e}, dane: {row}"))
                    continue
            
            # Zapisz pozostałe rekordy
            if batch:
                with transaction.atomic():
                    TimeSeriesData.objects.bulk_create(batch, ignore_conflicts=True)
                records_created += len(batch)
        
        self.stdout.write(self.style.SUCCESS(f"Zaimportowano {records_created} rekordów do bazy danych dla symbolu {symbol}"))