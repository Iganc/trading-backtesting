from django.db import models

class TimeSeriesData(models.Model):
    """Generyczny model dla danych czasowych"""
    symbol = models.CharField(max_length=20)  
    date = models.DateTimeField()
    open = models.FloatField()
    high = models.FloatField()
    low = models.FloatField()
    close = models.FloatField()
    volume = models.BigIntegerField()
    
    class Meta:
        unique_together = ['symbol', 'date']
        indexes = [
            models.Index(fields=['symbol', 'date']),
            models.Index(fields=['date']),
        ]
from django.contrib.auth.models import User

class BacktestingSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='backtesting_sessions')
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    instrument = models.CharField(max_length=50) 
    timeframe = models.CharField(max_length=10) 
    current_timestamp = models.DateTimeField(null=True, blank=True) 
    chart_state = models.JSONField(blank=True, null=True)
    open_positions = models.JSONField(blank=True, null=True)
    closed_positions = models.JSONField(blank=True, null=True)
    account_state = models.JSONField(blank=True, null=True)      
    parameters = models.JSONField(blank=True, null=True)         
    result = models.JSONField(blank=True, null=True)               

    def __str__(self):
        return f"{self.name} ({self.user.username})"