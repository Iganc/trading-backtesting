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