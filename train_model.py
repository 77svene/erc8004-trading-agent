import requests
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense
import tf2onnx
import json
import os
from datetime import datetime, timedelta

def fetch_ohlc(vs_currency='usdc', days=90):
    """Fetch OHLC data for WETH from CoinGecko."""
    url = f'https://api.coingecko.com/api/v3/coins/weth/ohlc'
    params = {'vs_currency': vs_currency, 'days': days}
    response = requests.get(url, params=params)
    data = response.json()
    # Each element: [timestamp, open, high, low, close]
    return data

def fetch_volume(vs_currency='usdc', days=90):
    """Fetch volume data for WETH from CoinGecko."""
    url = f'https://api.coingecko.com/api/v3/coins/weth/market_chart'
    params = {'vs_currency': vs_currency, 'days': days, 'interval': 'daily'}
    response = requests.get(url, params=params)
    data = response.json()
    # data['total_volumes']: [ [timestamp, volume], ... ]
    return data['total_volumes']

def preprocess_data(ohlc, volume, seq_length=20):
    """Combine OHLCV, normalize, and create sequences."""
    # Convert to numpy arrays
    ohlc = np.array(ohlc)
    volume = np.array(volume)
    
    # We assume the timestamps are the same and in the same order
    # Extract features: open, high, low, close, volume
    open_prices = ohlc[:,1]
    high_prices = ohlc[:,2]
    low_prices = ohlc[:,3]
    close_prices = ohlc[:,4]
    volumes = volume[:,1]
    
    # Stack features
    data = np.column_stack((open_prices, high_prices, low_prices, close_prices, volumes))
    
    # Normalize each feature to [0,1]
    min_vals = data.min(axis=0)
    max_vals = data.max(axis=0)
    # Avoid division by zero
    range_vals = max_vals - min_vals
    range_vals[range_vals == 0] = 1
    normalized_data = (data - min_vals) / range_vals
    
    # Save normalization parameters for later use in predictor
    norm_params = {
        'min': min_vals.tolist(),
        'max': max_vals.tolist()
    }
    
    # Create sequences
    X = []
    y = []
    for i in range(len(normalized_data) - seq_length):
        X.append(normalized_data[i:i+seq_length])
        # Predict the next close price (normalized)
        y.append(normalized_data[i+seq_length, 3])  # index 3 is close
    
    X = np.array(X)
    y = np.array(y)
    
    return X, y, norm_params

def build_model(input_shape):
    """Build a simple LSTM model."""
    model = Sequential([
        LSTM(50, activation='relu', input_shape=input_shape),
        Dense(1)
    ])
    model.compile(optimizer='adam', loss='mse')
    return model

def main():
    print('Fetching OHLC data...')
    ohlc = fetch_ohlc()
    print('Fetching volume data...')
    volume = fetch_volume()
    
    print('Preprocessing data...')
    X, y, norm_params = preprocess_data(ohlc, volume)
    
    # Save normalization parameters
    with open('src/agent/normalization.json', 'w') as f:
        json.dump(norm_params, f)
    
    print(f'X shape: {X.shape}, y shape: {y.shape}')
    
    # Split into train and test (80-20)
    split = int(0.8 * len(X))
    X_train, X_test = X[:split], X[split:]
    y_train, y_test = y[:split], y[split:]
    
    print('Building model...')
    model = build_model(input_shape=(X.shape[1], X.shape[2]))
    
    print('Training model...')
    model.fit(X_train, y_train, epochs=50, batch_size=32, validation_split=0.1, verbose=1)
    
    print('Evaluating model...')
    loss = model.evaluate(X_test, y_test, verbose=0)
    print(f'Test loss: {loss}')
    
    print('Exporting model to ONNX...')
    # Specify input signature
    spec = (tf.TensorSpec((None, X.shape[1], X.shape[2]), tf.float32, name='input'),)
    output_path = 'src/agent/model.onnx'
    model_proto, _ = tf2onnx.convert.from_keras(model, input_signature=spec, opset=13, output_path=output_path)
    
    print(f'Model saved to {output_path}')
    print('Normalization parameters saved to src/agent/normalization.json')

if __name__ == '__main__':
    main()
