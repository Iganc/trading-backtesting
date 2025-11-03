from django.shortcuts import render
from django.views import View
from django.http import HttpResponse, JsonResponse
from .models import TimeSeriesData
from datetime import datetime, timedelta
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')
import pandas as pd
import base64
from io import BytesIO
import mplfinance as mpf
import plotly.graph_objects as go
from plotly.offline import plot
from django.db.models import Min, Max, Count
from django.utils.timezone import make_aware
from django.shortcuts import render
from django.contrib.humanize.templatetags.humanize import intcomma
import json

class GenericChartView(View):
    """Generyczny view dla wykresów finansowych"""
    
    def get(self, request, symbol=None, date=None, startdate=None, enddate=None):
        # Mapowanie symboli
        symbol_mapping = {
            'ES': 'ES.v.0',
            'NQ': 'NQ.v.0'
        }
        
        # Konwersja symbolu na format w bazie danych
        if symbol:
            symbol = symbol_mapping.get(symbol.upper(), symbol)
        else:
            symbol = symbol or request.GET.get('symbol', 'ES.v.0')
            if symbol in symbol_mapping:
                symbol = symbol_mapping[symbol]
        
        if not date and not startdate and not enddate:
            date = request.GET.get('date')
            startdate = request.GET.get('start_date')
            enddate = request.GET.get('end_date')
        
        chart_type = request.GET.get('chart', 'json')
        interactive = request.GET.get('interactive', 'false').lower() == 'true'

        # Pobierz dane dla konkretnego symbolu
        base_query = TimeSeriesData.objects.filter(symbol=symbol)
        
        if date:
            try:
                target_date = datetime.strptime(date, '%Y-%m-%d').date()
                data = base_query.filter(date__date=target_date)
            except ValueError:
                return JsonResponse({'error': 'Nieprawidłowy format daty (YYYY-MM-DD)'}, status=400)
                
        elif startdate and enddate:
            try:
                start = datetime.strptime(startdate, '%Y-%m-%d')
                end = datetime.strptime(enddate, '%Y-%m-%d')
                data = base_query.filter(date__gte=start, date__lte=end)
            except ValueError:
                return JsonResponse({'error': 'Nieprawidłowy format daty (YYYY-MM-DD)'}, status=400)
        else:
            data = base_query.order_by('date')[:1000]  # Pierwsze 1000 rekordów chronologicznie

        if not data.exists():
            return JsonResponse({'error': f'Brak danych dla symbolu {symbol}'}, status=404)

        if chart_type == 'chart':
            if interactive:
                return self.generate_interactive_chart(data, symbol)
            else:
                return self.generate_candlestick_chart(data, symbol)
        else:
            return JsonResponse({
                'symbol': symbol,
                'data': list(data.values('date', 'open', 'high', 'low', 'close', 'volume')),
                'count': data.count()
            })
    
    def generate_interactive_chart(self, data, symbol, request=None):
        """Generuje interaktywny wykres dla dowolnego symbolu"""
        df_data = list(data.values('date', 'open', 'high', 'low', 'close', 'volume'))
        df = pd.DataFrame(df_data)
        
        if df.empty:
            return JsonResponse({'error': 'Brak danych do wykresu'}, status=404)
    
        # Konwertuj daty
        df['date'] = pd.to_datetime(df['date'])
        df.set_index('date', inplace=True)
        df = df.sort_index()
    
        # Przygotuj dane dla różnych timeframe'ów
        timeframes = {
            '1m': df,  # Oryginalne dane minutowe
            '5m': self._resample_data(df, '5T'),
            '15m': self._resample_data(df, '15T'),
            '1h': self._resample_data(df, '1H'),
            '4h': self._resample_data(df, '4H'),
            '1d': self._resample_data(df, '1D'),
        }
    
        # Stwórz subplot z przyciskami
        from plotly.subplots import make_subplots
        
        fig = go.Figure()
    
        # Dodaj wszystkie timeframe'y jako traces (początkowo ukryte)
        for tf, tf_data in timeframes.items():
            if not tf_data.empty:
                fig.add_trace(
                    go.Candlestick(
                        x=tf_data.index,
                        open=tf_data['open'],
                        high=tf_data['high'],
                        low=tf_data['low'],
                        close=tf_data['close'],
                        name=f'{symbol} ({tf})',
                        visible=(tf == '1h')  # Domyślnie pokaż 1h
                    )
                )
    
        # Stwórz przyciski do przełączania timeframe'ów
        buttons = []
        for i, (tf, tf_data) in enumerate(timeframes.items()):
            if not tf_data.empty:
                visible = [False] * len(timeframes)
                visible[i] = True
                
                buttons.append(
                    dict(
                        label=tf,
                        method="update",
                        args=[
                            {"visible": visible},
                            {"title": f"{symbol} - {tf} Timeframe"}
                        ]
                    )
                )
    
        # Konfiguracja
        fig.update_layout(
            title=f'{symbol} - 1h Timeframe',
            yaxis_title='Price ($)',
            xaxis_title='Date',
            template='plotly_white',
            height=700,
            showlegend=False,
            xaxis_rangeslider_visible=False,
            hovermode='x unified',
            updatemenus=[
                dict(
                    type="buttons",
                    direction="left",
                    buttons=buttons,
                    pad={"r": 10, "t": 10},
                    showactive=True,
                    x=0.01,
                    xanchor="left",
                    y=1.02,
                    yanchor="top"
                ),
            ]
        )
    
        graph_html = plot(fig, output_type='div', include_plotlyjs=True)
        
        count = data.count()
        first_date = df.index.min().strftime('%Y-%m-%d %H:%M')
        last_date = df.index.max().strftime('%Y-%m-%d %H:%M')
        
        # Pokazujemy "czytelny" symbol (ES zamiast ES.v.0)
        display_symbol = symbol
        if symbol == 'ES.v.0':
            display_symbol = 'ES'
        elif symbol == 'NQ.v.0':
            display_symbol = 'NQ'
        
        context = {
            'display_symbol': display_symbol,
            'count': count,
            'first_date': first_date,
            'last_date': last_date,
            'graph_html': graph_html
        }

        req = request if request is not None else getattr(self, 'request', None)
        if req is None:
            raise ValueError("Request object is required for rendering template")
        
        return render(req, 'backtest_app/interactive_chart.html', context)

    def generate_lightweight_chart(self, data, symbol, request=None):
        """Generuje wykres używając biblioteki Lightweight Charts"""
        df_data = list(data.values('date', 'open', 'high', 'low', 'close', 'volume'))
        df = pd.DataFrame(df_data)
        
        if df.empty:
            return JsonResponse({'error': 'Brak danych do wykresu'}, status=404)

        # Konwertuj daty
        df['date'] = pd.to_datetime(df['date'])
        df.set_index('date', inplace=True)
        df = df.sort_index()
        
        # Automatyczne dostosowanie rozdzielczości danych dla dużych zakresów
        data_points = len(df)
        date_range_days = (df.index.max() - df.index.min()).days
        data_warning = None
        
        # Określ czy mamy za dużo danych dla minutowego timeframe'a
        if date_range_days > 5 and data_points > 50000:
            data_warning = f"Duży zbiór danych ({data_points:,} punktów). Niektóre timeframe'y zostały automatycznie zagregowane dla lepszej wydajności."
        
        # Przygotuj dane dla różnych timeframe'ów
        timeframes = {}
        
        # Funkcja do konwersji danych na format dla Lightweight Charts
        def convert_to_lightweight_format(df):
            result = []
            for idx, row in df.iterrows():
                # Konwersja timestamp do formatu unix timestamp (sekundy)
                timestamp = int(idx.timestamp())
                result.append({
                    'time': timestamp,
                    'open': row['open'],
                    'high': row['high'],
                    'low': row['low'],
                    'close': row['close'],
                    'volume': int(row['volume'])
                })
            return result
        
        # Dodaj timeframe'y z ograniczeniem ilości danych
        # Minutowe dane tylko jeśli zakres jest rozsądny
        if date_range_days <= 5 or data_points <= 50000:
            timeframes['1m'] = convert_to_lightweight_format(df)
        
        # Dla pozostałych timeframe'ów zawsze agreguj
        timeframes['5m'] = convert_to_lightweight_format(self._resample_data(df, '5T'))
        timeframes['15m'] = convert_to_lightweight_format(self._resample_data(df, '15T'))
        timeframes['1h'] = convert_to_lightweight_format(self._resample_data(df, '1H'))
        timeframes['4h'] = convert_to_lightweight_format(self._resample_data(df, '4H'))
        timeframes['1d'] = convert_to_lightweight_format(self._resample_data(df, '1D'))
        
        # Pokazujemy "czytelny" symbol (ES zamiast ES.v.0)
        display_symbol = symbol
        if symbol == 'ES.v.0':
            display_symbol = 'ES'
        elif symbol == 'NQ.v.0':
            display_symbol = 'NQ'
        
        # Konwertuj dane na format JSON
        chart_data_json = json.dumps(timeframes)
        
        count = data.count()
        start_date = df.index.min().strftime('%Y-%m-%d %H:%M')
        end_date = df.index.max().strftime('%Y-%m-%d %H:%M')
        
        context = {
            'display_symbol': display_symbol,
            'count': count,
            'start_date': start_date,
            'end_date': end_date,
            'chart_data': chart_data_json,
            'data_warning': data_warning
        }
        
        req = request if request is not None else getattr(self, 'request', None)
        if req is None:
            raise ValueError("Request object is required for rendering template")
        
        return render(req, 'backtest_app/lightweight_chart.html', context)

    def _resample_data(self, df, frequency):
        """Resample data to different timeframes"""
        if df.empty:
            return df
            
        try:
            resampled = df.resample(frequency).agg({
                'open': 'first',
                'high': 'max',
                'low': 'min',
                'close': 'last',
                'volume': 'sum'
            }).dropna()
            return resampled
        except Exception as e:
            print(f"Error resampling to {frequency}: {e}")
            return pd.DataFrame()
    
    def generate_candlestick_chart(self, data, symbol, request=None):
        """Generuje statyczny wykres świeczek"""
        df_data = list(data.values('date', 'open', 'high', 'low', 'close', 'volume'))
        df = pd.DataFrame(df_data)
        
        if df.empty:
            return JsonResponse({'error': 'Brak danych do wykresu'}, status=404)
    
        df['date'] = pd.to_datetime(df['date'])
        df.set_index('date', inplace=True)
        
        df.rename(columns={
            'open': 'Open', 'high': 'High', 'low': 'Low',
            'close': 'Close', 'volume': 'Volume'
        }, inplace=True)
        
        # Wykres
        fig, axes = mpf.plot(
            df,
            type='candle',
            style='yahoo',
            title=f'{symbol} Candlestick Chart',
            ylabel='Price ($)',
            volume=False,
            figsize=(12, 8),
            returnfig=True,
            tight_layout=True,
            show_nontrading=True  # Pokaż wszystkie dane (24/7)
        )
        
        # Zapisz jako obraz
        buffer = BytesIO()
        fig.savefig(buffer, format='png', dpi=300, bbox_inches='tight')
        buffer.seek(0)
        
        image_base64 = base64.b64encode(buffer.getvalue()).decode()
        plt.close(fig)
        
        # Użyj pandas DataFrame dla dat
        first_date = df.index.min()
        last_date = df.index.max()
        
        # Pokazujemy "czytelny" symbol (ES zamiast ES.v.0)
        display_symbol = symbol
        if symbol == 'ES.v.0':
            display_symbol = 'ES'
        elif symbol == 'NQ.v.0':
            display_symbol = 'NQ'
        
        context = {
            'display_symbol': display_symbol,
            'data': data,
            'first_date': first_date,
            'last_date': last_date,
            'image_base64': image_base64
        }
        
        req = request if request is not None else getattr(self, 'request', None)
        if req is None:
            raise ValueError("Request object is required for rendering template")
        
        return render(req, 'backtest_app/interactive_chart.html', context)

def home_view(request):
    """Strona główna z odnośnikami do ES i NQ"""
    
    # Pobierz dane o dostępnych zakresach dla ES.v.0 i NQ.v.0
    symbols = {
        'ES': 'ES.v.0',
        'NQ': 'NQ.v.0'
    }
    
    data = {}
    for display_symbol, db_symbol in symbols.items():
        # Pobierz najnowsze dane dla symbolu
        latest = TimeSeriesData.objects.filter(symbol=db_symbol).order_by('-date').first()
        earliest = TimeSeriesData.objects.filter(symbol=db_symbol).order_by('date').first()
        
        if latest and earliest:
            data[display_symbol] = {
                'latest_date': latest.date.strftime('%Y-%m-%d'),
                'earliest_date': earliest.date.strftime('%Y-%m-%d'),
                'latest_price': latest.close,
                'total_records': TimeSeriesData.objects.filter(symbol=db_symbol).count()
            }
    import random
    start = earliest.date
    end = latest.date
    usable_range_start = start + timedelta(days=3)  
    usable_range_end = end - timedelta(days=3) 
    if usable_range_start <= usable_range_end:
        # Losuj datę z użytecznego zakresu
        random_timestamp = random.randint(
            int(usable_range_start.timestamp()),
            int(usable_range_end.timestamp())
        )
        random_date = datetime.fromtimestamp(random_timestamp).date()
    else:
        # Jeśli zakres jest zbyt mały, po prostu użyj środkowego punktu
        middle_point = start + (end - start) / 2
        random_date = middle_point.date()
    
    # Stwórz zakres dat (+/- 3 dni)
    random_date_from = random_date - timedelta(days=3)
    random_date_to = random_date + timedelta(days=3)
    today = datetime.now().strftime('%Y-%m-%d')
    last_week = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
    last_month = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    last_year = (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d')
    user_sessions = []
    if request.user.is_authenticated:
        user_sessions = BacktestingSession.objects.filter(user=request.user).order_by('-created_at')

    context = {
        'data': data,
        'today': today,
        'last_week': last_week,
        'last_month': last_month,
        'last_year': last_year,
        'random_date_from': random_date_from.strftime('%Y-%m-%d'),
        'random_date_to': random_date_to.strftime('%Y-%m-%d'),
        'user_sessions': user_sessions
    }
    
    return render(request, 'backtest_app/home.html', context)


def symbol_date_view(request, symbol, start_date):
    """Widok dla symbolu od daty początkowej do końca dostępnych danych"""
    # Tłumaczenie symboli
    symbol_mapping = {
        'ES': 'ES.v.0',
        'NQ': 'NQ.v.0'
    }
    
    # Konwersja symbolu na format w bazie danych
    db_symbol = symbol_mapping.get(symbol.upper(), symbol)
    
    # Parametry
    chart_type = request.GET.get('chart', 'chart')
    interactive = request.GET.get('interactive', 'true').lower() == 'true'
    
    try:
        start_date_obj = datetime.strptime(start_date, '%Y-%m-%d')
    except ValueError:
        return JsonResponse({'error': 'Nieprawidłowy format daty początkowej (YYYY-MM-DD)'}, status=400)
    
    # Pobierz dane od daty początkowej
    data = TimeSeriesData.objects.filter(
        symbol=db_symbol,
        date__gte=start_date_obj
    ).order_by('date')
    
    if not data.exists():
        return JsonResponse({
            'error': f'Brak danych dla symbolu {symbol} od daty {start_date}'
        }, status=404)
    
    # Jeśli proszono o wykres
    if chart_type == 'chart':
        chart_view = GenericChartView()
        
        chart_lib = request.GET.get('lib', 'lightweight')  # domyślnie używaj lightweight
        
        # Wybierz odpowiednią bibliotekę wykresów
        if chart_lib == 'lightweight':
            return chart_view.generate_lightweight_chart(data, db_symbol, request)
        elif chart_lib == 'plotly':  # oryginalna interaktywna
            return chart_view.generate_interactive_chart(data, db_symbol, request)
        else:  # statyczna
            return chart_view.generate_candlestick_chart(data, db_symbol, request)
        
    # W przeciwnym razie zwróć JSON
    return JsonResponse({
        'symbol': symbol,
        'db_symbol': db_symbol,
        'start_date': start_date,
        'end_date': data.last().date.strftime('%Y-%m-%d'),
        'data': list(data.values('date', 'open', 'high', 'low', 'close', 'volume')),
        'count': data.count()
    })


def symbol_date_range_view(request, symbol, start_date, end_date):
    """Widok dla symbolu z zakresem dat"""
    # Tłumaczenie symboli
    symbol_mapping = {
        'ES': 'ES.v.0',
        'NQ': 'NQ.v.0'
    }
    
    # Konwersja symbolu na format w bazie danych
    db_symbol = symbol_mapping.get(symbol.upper(), symbol)
    
    # Parametry
    chart_type = request.GET.get('chart', 'chart')
    chart_lib = request.GET.get('lib', 'lightweight')  # domyślnie używaj lightweight
    
    interactive = request.GET.get('interactive', 'true').lower() == 'true'
    
    try:
        start_date_obj = datetime.strptime(start_date, '%Y-%m-%d')
        end_date_obj = datetime.strptime(end_date, '%Y-%m-%d')
    except ValueError:
        return JsonResponse({'error': 'Nieprawidłowy format daty (YYYY-MM-DD)'}, status=400)
    
    # Pobierz dane w zakresie dat
    data = TimeSeriesData.objects.filter(
        symbol=db_symbol,
        date__gte=start_date_obj,
        date__lte=end_date_obj
    ).order_by('date')
    
    if not data.exists():
        return JsonResponse({
            'error': f'Brak danych dla symbolu {symbol} w zakresie {start_date} - {end_date}'
        }, status=404)
    
    # Jeśli proszono o wykres
    if chart_type == 'chart':
        chart_view = GenericChartView()
        
        # Wybierz odpowiednią bibliotekę wykresów
        if chart_lib == 'lightweight':
            return chart_view.generate_lightweight_chart(data, db_symbol, request)
        elif chart_lib == 'plotly':  # oryginalna interaktywna
            return chart_view.generate_interactive_chart(data, db_symbol, request)
        else:  # statyczna
            return chart_view.generate_candlestick_chart(data, db_symbol, request)
    
    # W przeciwnym razie zwróć JSON
    return JsonResponse({
        'symbol': symbol,
        'db_symbol': db_symbol,
        'start_date': start_date,
        'end_date': end_date,
        'data': list(data.values('date', 'open', 'high', 'low', 'close', 'volume')),
        'count': data.count()
    })


def available_contracts(request):
    """Zwraca listę dostępnych kontraktów z zakresami dat"""
    contracts = TimeSeriesData.objects.values('symbol').annotate(
        start_date=Min('date'),
        end_date=Max('date'),
        count=Count('id')
    ).order_by('start_date')
    
    return JsonResponse(list(contracts), safe=False)

from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from .models import BacktestingSession

@csrf_exempt
@login_required
def save_backtesting_session(request):
    """Zapisuje sesję backtestingu (parametry + wynik)"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Metoda niedozwolona'}, status=405)

    try:
        data = json.loads(request.body)
        name = data.get('name', '')
        parameters = data.get('parameters', {})
        result = data.get('result', {})
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Niepoprawny format JSON'}, status=400)

    session = BacktestingSession.objects.create(
        user=request.user,
        name=name,
        parameters=parameters,
        result=result
    )
    print("FROM save_backtesting_session: ", session)
    return JsonResponse({'message': 'Sesja zapisana', 'session_id': session.id}, status=201)

@login_required
def load_backtesting_session(request, session_id):
    """Wczytuje zapisaną sesję użytkownika"""
    try:
        session = BacktestingSession.objects.get(id=session_id, user=request.user)
    except BacktestingSession.DoesNotExist:
        return JsonResponse({'error': 'Nie znaleziono sesji'}, status=404)
    print("FROM load_backtesting_session: ", session)
    return JsonResponse({
        'id': session.id,
        'name': session.name,
        'created_at': session.created_at,
        'parameters': session.parameters,
        'result': session.result
    })

from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator

@login_required
def chart_from_session(request, session_id):
    """Wczytuje dane wybranej sesji i renderuje lightweight_chart.html"""
    try:
        session = BacktestingSession.objects.get(id=session_id, user=request.user)
    except BacktestingSession.DoesNotExist:
        return JsonResponse({'error': 'Nie znaleziono sesji'}, status=404)

    chart_data_dict = session.result.get('candles_data', [])
    if not chart_data_dict:
        return JsonResponse({'error': 'Brak danych świec w sesji'}, status=404)
    
    symbol = session.parameters.get('symbol', 'ES')
    start_date = session.parameters.get('start_date', '')
    end_date = session.parameters.get('end_date', '')

    symbol_mapping = {
        'ES': 'ES.v.0',
        'NQ': 'NQ.v.0'
    }
    db_symbol = symbol_mapping.get(symbol.upper(), symbol)


    from .models import TimeSeriesData
    if start_date and end_date:
        total_candles = TimeSeriesData.objects.filter(
            symbol=db_symbol,
            date__gte=start_date,
            date__lte=end_date
        ).count()
    elif start_date:
        total_candles = TimeSeriesData.objects.filter(
            symbol=db_symbol,
            date__gte=start_date
        ).count()
    else:
        total_candles = TimeSeriesData.objects.filter(
            symbol=db_symbol
        ).count()
    visible_candles = min(session.result.get('visible_candles', len(chart_data_dict)), total_candles)
    session_total_candles = session.result.get('total_candles', total_candles)
    context = {
        'display_symbol': symbol,
        'chart_data': json.dumps({'1h': chart_data_dict}),  
        'start_date': start_date,
        'end_date': end_date,
        'session_id': session.id,
        'visible_candles': visible_candles,
        'total_candles': total_candles,
        'session_total_candles': session_total_candles,
    }

    return render(request, 'backtest_app/lightweight_chart.html', context)
