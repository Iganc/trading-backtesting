from django.shortcuts import render
from django.views import View
from django.http import HttpResponse, JsonResponse
from .models import TimeSeriesData
from datetime import datetime, timedelta
import pandas as pd
from django.db.models import Min, Max, Count
from django.utils.timezone import make_aware
from django.shortcuts import render
from django.contrib.humanize.templatetags.humanize import intcomma
import json

class GenericChartView(View):
    
    def get(self, request, symbol=None, date=None, startdate=None, enddate=None):
        symbol_mapping = {
            'ES': 'ES.v.0',
            'NQ': 'NQ.v.0'
        }
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
            data = base_query.order_by('date')[:1000] 

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
    
    def generate_lightweight_chart(self, data, symbol, request=None):
        """Generuje wykres używając biblioteki Lightweight Charts"""
        df_data = list(data.values('date', 'open', 'high', 'low', 'close', 'volume'))
        df = pd.DataFrame(df_data)
        
        if df.empty:
            return JsonResponse({'error': 'Brak danych do wykresu'}, status=404)

        df['date'] = pd.to_datetime(df['date'])
        df.set_index('date', inplace=True)
        df = df.sort_index()
        
        data_points = len(df)
        date_range_days = (df.index.max() - df.index.min()).days
        data_warning = None
        
        if date_range_days > 5 and data_points > 50000:
            data_warning = f"Duży zbiór danych ({data_points:,} punktów). Niektóre timeframe'y zostały automatycznie zagregowane dla lepszej wydajności."
        
        timeframes = {}
        
        def convert_to_lightweight_format(df):
            result = []
            for idx, row in df.iterrows():
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
        
        if date_range_days <= 5 or data_points <= 50000:
            timeframes['1m'] = convert_to_lightweight_format(df)
        
        timeframes['5m'] = convert_to_lightweight_format(self._resample_data(df, '5T'))
        timeframes['15m'] = convert_to_lightweight_format(self._resample_data(df, '15T'))
        timeframes['1h'] = convert_to_lightweight_format(self._resample_data(df, '1H'))
        timeframes['4h'] = convert_to_lightweight_format(self._resample_data(df, '4H'))
        timeframes['1d'] = convert_to_lightweight_format(self._resample_data(df, '1D'))
        
        display_symbol = symbol
        if symbol == 'ES.v.0':
            display_symbol = 'ES'
        elif symbol == 'NQ.v.0':
            display_symbol = 'NQ'
        
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
    

def home_view(request):
    """Strona główna z odnośnikami do ES i NQ"""
    
    symbols = {
        'ES': 'ES.v.0',
        'NQ': 'NQ.v.0'
    }
    
    data = {}
    for display_symbol, db_symbol in symbols.items():
        latest = TimeSeriesData.objects.filter(symbol=db_symbol).order_by('-date').first()
        earliest = TimeSeriesData.objects.filter(symbol=db_symbol).order_by('date').first()
        
        if latest and earliest:
            data[display_symbol] = {
                'latest_date': latest.date.strftime('%Y-%m-%d'),
                'earliest_date': earliest.date.strftime('%Y-%m-%d'),
                'latest_price': latest.close,
                'total_records': TimeSeriesData.objects.filter(symbol=db_symbol).count(),
                'week_ago': (latest.date - timedelta(days=7)).strftime('%Y-%m-%d'),
                'month_ago': (latest.date - timedelta(days=30)).strftime('%Y-%m-%d'),
            }
    import random
    start = earliest.date
    end = latest.date
    usable_range_start = start + timedelta(days=3)  
    usable_range_end = end - timedelta(days=3) 
    if usable_range_start <= usable_range_end:
        random_timestamp = random.randint(
            int(usable_range_start.timestamp()),
            int(usable_range_end.timestamp())
        )
        random_date = datetime.fromtimestamp(random_timestamp).date()
    else:
        middle_point = start + (end - start) / 2
        random_date = middle_point.date()
    
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
    symbol_mapping = {
        'ES': 'ES.v.0',
        'NQ': 'NQ.v.0'
    }
    
    db_symbol = symbol_mapping.get(symbol.upper(), symbol)
    
    chart_type = request.GET.get('chart', 'chart')
    interactive = request.GET.get('interactive', 'true').lower() == 'true'
    
    try:
        start_date_obj = datetime.strptime(start_date, '%Y-%m-%d')
    except ValueError:
        return JsonResponse({'error': 'Nieprawidłowy format daty początkowej (YYYY-MM-DD)'}, status=400)
    
    data = TimeSeriesData.objects.filter(
        symbol=db_symbol,
        date__gte=start_date_obj
    ).order_by('date')
    
    if not data.exists():
        return JsonResponse({
            'error': f'Brak danych dla symbolu {symbol} od daty {start_date}'
        }, status=404)
    
    if chart_type == 'chart':
        chart_view = GenericChartView()
        
        chart_lib = request.GET.get('lib', 'lightweight')
        
        if chart_lib == 'lightweight':
            return chart_view.generate_lightweight_chart(data, db_symbol, request)
        else: 
            return chart_view.generate_candlestick_chart(data, db_symbol, request)
        
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
    symbol_mapping = {
        'ES': 'ES.v.0',
        'NQ': 'NQ.v.0'
    }
    
    db_symbol = symbol_mapping.get(symbol.upper(), symbol)
    
    chart_type = request.GET.get('chart', 'chart')
    chart_lib = request.GET.get('lib', 'lightweight') 
    interactive = request.GET.get('interactive', 'true').lower() == 'true'
    
    try:
        start_date_obj = datetime.strptime(start_date, '%Y-%m-%d')
        end_date_obj = datetime.strptime(end_date, '%Y-%m-%d')
    except ValueError:
        return JsonResponse({'error': 'Nieprawidłowy format daty (YYYY-MM-DD)'}, status=400)
    
    data = TimeSeriesData.objects.filter(
        symbol=db_symbol,
        date__gte=start_date_obj,
        date__lte=end_date_obj
    ).order_by('date')
    
    if not data.exists():
        return JsonResponse({
            'error': f'Brak danych dla symbolu {symbol} w zakresie {start_date} - {end_date}'
        }, status=404)
    
    if chart_type == 'chart':
        chart_view = GenericChartView()
        
        if chart_lib == 'lightweight':
            return chart_view.generate_lightweight_chart(data, db_symbol, request)
        else: 
            return chart_view.generate_candlestick_chart(data, db_symbol, request)
    
    return JsonResponse({
        'symbol': symbol,
        'db_symbol': db_symbol,
        'start_date': start_date,
        'end_date': end_date,
        'data': list(data.values('date', 'open', 'high', 'low', 'close', 'volume')),
        'count': data.count()
    })


from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from .models import BacktestingSession

@csrf_exempt
@login_required
def save_backtesting_session(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Metoda niedozwolona'}, status=405)

    try:
        data = json.loads(request.body)
        name = data.get('name', '').strip()
        if not name:
            return JsonResponse({'error': 'Nazwa sesji jest wymagana'}, status=400)
        balance = float(data.get('balance', 100000))
        parameters = data.get('parameters', {})
        result = data.get('result', {})
        account_state = data.get('account_state', {'balance': balance})
        start_date = data.get('start_date', '')
        end_date = data.get('end_date', '')
        symbol = data.get('symbol', '')
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'error': 'Niepoprawny format danych'}, status=400)

    session = BacktestingSession.objects.create(
        user=request.user,
        name=name,
        parameters={**parameters, 'symbol': symbol, 'start_date': start_date, 'end_date': end_date},
        result=result,
        account_state=account_state
    )
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
        'result': session.result,
        'account_state': session.account_state 
    })

from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator

@login_required
def chart_from_session(request, session_id):
    try:
        session = BacktestingSession.objects.get(id=session_id, user=request.user)
    except BacktestingSession.DoesNotExist:
        return JsonResponse({'error': 'Nie znaleziono sesji'}, status=404)

    # Pobierz minutowe dane
    minute_candles = session.result.get('candles_data', [])
    if not minute_candles:
        return JsonResponse({'error': 'Brak danych świec w sesji'}, status=404)

    # Konwertuj dane do DataFrame
    df = pd.DataFrame(minute_candles)
    df['time'] = pd.to_datetime(df['time'], unit='s')
    df.set_index('time', inplace=True)
    df = df.sort_index()

    def resample_data(df, frequency):
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

    def convert_to_lightweight_format(df):
        """Convert DataFrame to Lightweight Charts format"""
        result = []
        for idx, row in df.iterrows():
            timestamp = int(idx.timestamp())
            result.append({
                'time': timestamp,
                'open': float(row['open']),
                'high': float(row['high']),
                'low': float(row['low']),
                'close': float(row['close']),
                'volume': float(row['volume'])
            })
        return result

    # Przygotuj dane dla różnych timeframe'ów
    timeframes = {
        '1m': minute_candles,  # oryginalne minutowe dane
        '5m': convert_to_lightweight_format(resample_data(df, '5T')),
        '15m': convert_to_lightweight_format(resample_data(df, '15T')),
        '1h': convert_to_lightweight_format(resample_data(df, '1H')),
        '4h': convert_to_lightweight_format(resample_data(df, '4H')),
        '1d': convert_to_lightweight_format(resample_data(df, '1D'))
    }

    symbol = session.parameters.get('symbol', 'ES')
    start_date = session.parameters.get('start_date', '')
    end_date = session.parameters.get('end_date', '')

    symbol_mapping = {
        'ES': 'ES.v.0',
        'NQ': 'NQ.v.0'
    }
    db_symbol = symbol_mapping.get(symbol.upper(), symbol)

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

    visible_candles = min(session.result.get('visible_candles', len(minute_candles)), total_candles)
    session_total_candles = session.result.get('total_candles', total_candles)

    data_points = len(minute_candles)
    date_range_days = (df.index.max() - df.index.min()).days
    data_warning = None
    if date_range_days > 5 and data_points > 50000:
        data_warning = f"Duży zbiór danych ({data_points:,} punktów). Niektóre timeframe'y zostały automatycznie zagregowane dla lepszej wydajności."

    context = {
        'display_symbol': symbol,
        'chart_data': json.dumps(timeframes),
        'start_date': start_date,
        'end_date': end_date,
        'session_id': session.id,
        'visible_candles': visible_candles,
        'total_candles': total_candles,
        'session_total_candles': session_total_candles,
        'current_candle': json.dumps(session.result.get('current_candle', {})),
        'account_state': session.account_state,
        'session_name': session.name,
        'session_balance': session.account_state.get('balance', 100000),
        'data_warning': data_warning
    }

    return render(request, 'backtest_app/lightweight_chart.html', context)

from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
@login_required
def update_backtesting_session(request, session_id):
    if request.method != 'PUT':
        return JsonResponse({'error': 'Metoda niedozwolona'}, status=405)
    try:
        session = BacktestingSession.objects.get(id=session_id, user=request.user)
    except BacktestingSession.DoesNotExist:
        return JsonResponse({'error': 'Nie znaleziono sesji'}, status=404)
    try:
        data = json.loads(request.body)
        session.name = data.get('name', session.name)
        session.parameters = data.get('parameters', session.parameters)
        session.result = data.get('result', session.result)
        session.account_state = data.get('account_state', session.account_state)
        session.save()
        return JsonResponse({'message': 'Sesja zaktualizowana', 'session_id': session.id}, status=200)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)