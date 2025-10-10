import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backtesting.settings')
django.setup()

import yfinance as yf
from datetime import datetime, timedelta
from backtest_app.models import SP500

yesterday = datetime.now() - timedelta(days=1)
yesterday_str = yesterday.strftime('%Y-%m-%d')
data = yf.download("^GSPC", interval="1m",
                   start=(yesterday - timedelta(days=7)).strftime('%Y-%m-%d'),
                   end=yesterday_str)

data.columns = data.columns.droplevel(1)

print(data.head())

for index, row in data.iterrows():
    SP500.objects.create(
        date=index,
        open=row['Open'],
        high=row['High'],
        low=row['Low'],
        close=row['Close'],
        adj_close=row['Close'],
        volume=row['Volume']
    )
