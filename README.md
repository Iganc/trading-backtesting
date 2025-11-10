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

## Photo Gallery

home: 
<img width="1926" height="924" alt="image" src="https://github.com/user-attachments/assets/e810d27f-9ee9-4799-b661-d7840461b1c2" />

choosing an instrument and the time:
<img width="1905" height="888" alt="image" src="https://github.com/user-attachments/assets/81dcb01a-cc05-4524-92fd-8eb92f077254" />

after choosing an instrument:
<img width="1914" height="914" alt="image" src="https://github.com/user-attachments/assets/f113f92b-bd21-4f79-9aa8-c0a415907a91" />

after using bar replay:
<img width="1914" height="915" alt="image" src="https://github.com/user-attachments/assets/986dd558-b27e-4483-9103-69040e7818fc" />

drawing:
<img width="1922" height="926" alt="image" src="https://github.com/user-attachments/assets/4066413d-0b14-4b70-a3dd-4685ab4c64c7" />

opened positions:
<img width="1913" height="918" alt="image" src="https://github.com/user-attachments/assets/fc815bdb-f911-4edd-9410-d49eef22368d" />

saving a session:
<img width="1914" height="914" alt="image" src="https://github.com/user-attachments/assets/e51e6d30-536f-4e0c-bc35-419c3c3d1f1a" />


tracking the balance from a saved session:
<img width="1915" height="909" alt="image" src="https://github.com/user-attachments/assets/02fa7e90-5bc0-43ed-a13f-d177e69521e6" />


