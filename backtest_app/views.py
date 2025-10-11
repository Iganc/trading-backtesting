from django.shortcuts import render
from django.views import View
from django.http import HttpResponse
from django.http import JsonResponse
from .models import SP500
from datetime import datetime
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')
import pandas as pd
import base64
from io import BytesIO

class SP500View(View):
    def get(self, request, date=None, startdate=None, enddate=None):
        # Jeśli parametry nie są w URL, sprawdź query parameters
        if not date and not startdate and not enddate:
            date = request.GET.get('date')
            startdate = request.GET.get('start_date')
            enddate = request.GET.get('end_date')
        
        chart_type = request.GET.get('chart', 'json')

        if date:
            try:
                target_date = datetime.strptime(date, '%Y-%m-%d').date()
                data = SP500.objects.filter(date__date=target_date).order_by('date')
            except ValueError:
                return JsonResponse({'error': 'Nieprawidłowy format daty (YYYY-MM-DD)'}, status=400)
                
        elif startdate and enddate:
            try:
                start = datetime.strptime(startdate, '%Y-%m-%d')
                end = datetime.strptime(enddate, '%Y-%m-%d')
                data = SP500.objects.filter(date__gte=start, date__lte=end).order_by('date')
            except ValueError:
                return JsonResponse({'error': 'Nieprawidłowy format daty (YYYY-MM-DD)'}, status=400)
        else:
            # Ostatnie 100 rekordów jako domyślne
            data = SP500.objects.all().order_by('-date')[:100]
            data = list(reversed(data))

        # Sprawdź czy generować wykres czy JSON
        if chart_type == 'chart':
            return self.generate_chart(data)
        else:
            return JsonResponse({
                'data': list(data.values('date', 'open', 'high', 'low', 'close', 'volume')) if hasattr(data, 'values') else [
                    {'date': item.date, 'open': item.open, 'high': item.high, 'low': item.low, 'close': item.close, 'volume': item.volume}
                    for item in data
                ],
                'count': len(data) if isinstance(data, list) else data.count()
            })
        
    def generate_chart(self, data):
        """Generuje wykres i zwraca jako obraz"""
        if not data.exists():
            return JsonResponse({'error': 'Brak danych do wykresu'}, status=404)
            
        # Przygotuj dane
        df = pd.DataFrame(list(data.values('date', 'open', 'high', 'low', 'close', 'volume')))
        
        # Stwórz wykres
        plt.figure(figsize=(12, 8))
        
        # Subplot 1: Cena
        plt.subplot(2, 1, 1)
        plt.plot(df['date'], df['close'], label='Close Price', color='blue', linewidth=1)
        plt.plot(df['date'], df['open'], label='Open Price', color='green', linewidth=0.5, alpha=0.7)
        plt.title('S&P 500 Price Chart')
        plt.ylabel('Price ($)')
        plt.legend()
        plt.grid(True, alpha=0.3)
        
        # Subplot 2: Volume
        plt.subplot(2, 1, 2)
        plt.bar(df['date'], df['volume'], alpha=0.7, color='orange', width=0.8)
        plt.title('Volume')
        plt.ylabel('Volume')
        plt.xlabel('Date')
        plt.grid(True, alpha=0.3)
        
        # Formatowanie dat na osi X
        plt.xticks(rotation=45)
        plt.tight_layout()
        
        # Zapisz wykres do pamięci
        buffer = BytesIO()
        plt.savefig(buffer, format='png', dpi=300, bbox_inches='tight')
        buffer.seek(0)
        
        # Konwertuj na base64
        image_base64 = base64.b64encode(buffer.getvalue()).decode()
        plt.close()  # Zamknij wykres żeby zwolnić pamięć
        
        # Zwróć jako HTML z wykresem
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>S&P 500 Chart</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                .chart {{ text-align: center; }}
                .info {{ background: #f0f0f0; padding: 10px; margin: 10px 0; }}
            </style>
        </head>
        <body>
            <h1>S&P 500 Chart</h1>
            <div class="info">
                <p>Records: {data.count()}</p>
                <p>Date range: {data.first().date} to {data.last().date}</p>
            </div>
            <div class="chart">
                <img src="data:image/png;base64,{image_base64}" alt="S&P 500 Chart" style="max-width: 100%;">
            </div>
        </body>
        </html>
        """
        
        return HttpResponse(html_content, content_type='text/html')

class SP500ChartView(View):
    """Dedykowany view tylko do wykresów"""
    def get(self, request):
        # Tylko wykresy
        view = SP500View()
        request.GET = request.GET.copy()
        request.GET['chart'] = 'chart'
        return view.get(request)