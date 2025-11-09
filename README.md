# Continuous Contract Backtesting

A Django-based web platform for analyzing and backtesting trading strategies on historical futures data (e.g., ES, NQ).  
It features interactive candlestick charts, drawing tools (lines, rectangles for fair value gaps, Fibonacci retracements), and position simulation (long/short) with stop loss and take profit management.  
Each user has an individual balance and can save or restore backtesting sessions.

---

## Features

- **Import** historical data from CSV into SQLite (`backtest_app/management/commands/import_csv.py`)
- **Visualize** minute-level futures data (from 2010) across multiple timeframes (1m, 5m, 15m, 1h, 4h, 1d)
- **Draw** Fibonacci retracements, lines, and rectangles (for marking fair value gaps)
- **Simulate** long/short positions with risk/reward, stop loss, and take profit visualization
- **Replay** price action with bar-by-bar candle playback
- **Track** user-specific balances
- **Save and restore** backtesting sessions with parameters, results, and chart drawings
- **Randomize** starting dates for backtesting
- **Manage** user accounts (registration, login, password reset)
- **Access** data via a Django REST API

---

## How to Run

1. **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
2. **Import your data:**
    ```bash
    python manage.py import_csv <path_to_csv>
    ```
3. **Start the server:**
    ```bash
    python manage.py runserver
    ```
4. **Open your browser:**
    ```
    http://127.0.0.1:8000/
    ```

---

## Technologies

- Django 5.2  
- Django REST Framework  
- Pandas  
- Lightweight Charts (JavaScript, interactive charting)  
- SQLite

---

## Author

Developed as an educational project to explore, test, and visualize trading strategies on historical futures data.
