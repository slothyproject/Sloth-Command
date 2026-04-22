/**
 * AI Predictions Component
 * Predictive analytics and forecasting - with real API integration
 */

'use client';

import React, { useState } from 'react';
import { useServices } from '@/app/hooks/use-services';
import { useAIPredictions, type AIPrediction as AIPredictionType } from '@/app/hooks/use-ai';
import { cn } from '@/app/lib/utils';

interface AIPredictionsProps {
  services?: unknown[];
}

export function AIPredictions({ services: _services }: AIPredictionsProps) {
  const { data: services, isLoading: servicesLoading } = useServices();
  const [selectedService, setSelectedService] = useState<string>(services?.[0]?.id || '');
  const [predictionHours, setPredictionHours] = useState(24);
  
  const { data: predictions, isLoading: predictionsLoading } = useAIPredictions(
    selectedService, 
    predictionHours
  );

  const isLoading = servicesLoading || predictionsLoading;

  // Transform predictions for display
  const predictionCards = React.useMemo(() => {
    if (!predictions) return [];
    
    return predictions.slice(0, 3).map((pred, idx) => ({
      id: `${pred.metric}-${idx}`,
      metric: pred.metric,
      service: services?.find(s => s.id === selectedService)?.name || 'Unknown',
      currentValue: `${pred.current.toFixed(1)}%`,
      predictedValue: `${pred.predicted.toFixed(1)}%`,
      trend: pred.trend,
      confidence: Math.round(pred.confidence * 100),
      timeframe: `Next ${predictionHours} hours`,
      recommendation: pred.alerts?.[0] || 'No action needed',
    }));
  }, [predictions, services, selectedService, predictionHours]);

  // Generate forecast chart data
  const forecastData = React.useMemo(() => {
    if (!predictions || predictions.length === 0) return [];
    
    // Use the first prediction's forecast data
    const firstPrediction = predictions[0];
    if (!firstPrediction.forecast) return [];
    
    return firstPrediction.forecast.map((point) => ({
      time: new Date(point.timestamp).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      value: point.value,
      confidence: point.confidence,
    }));
  }, [predictions]);

  if (isLoading) {
    return <PredictionsSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">Service:</label>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-900/50 border border-white/10 text-white text-sm focus:outline-none focus:border-violet-500"
            >
              {services?.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">Forecast:</label>
            <div className="flex gap-1">
              {[24, 48, 72].map((hours) => (
                <button
                  key={hours}
                  onClick={() => setPredictionHours(hours)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm transition-colors",
                    predictionHours === hours
                      ? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  )}
                >
                  {hours}h
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Prediction Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {predictionCards.map((prediction) => (
          <PredictionCard key={prediction.id} prediction={prediction} />
        ))}
        
        {predictionCards.length === 0 && (
          <div className="md:col-span-3 glass-card p-6 text-center">
            <Icon name="TrendingUp" className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No predictions available for this service</p>
            <p className="text-sm text-slate-500 mt-1">
              Select a different service or wait for AI analysis to complete
            </p>
          </div>
        )}
      </div>

      {/* Forecast Chart */}
      {forecastData.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-white">
                {predictions?.[0]?.metric || 'Metric'} Forecast
              </h3>
              <p className="text-sm text-slate-400">
                AI-powered prediction for the next {predictionHours} hours
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <LegendItem color="#06b6d4" label="Predicted" />
              <LegendItem color="#8b5cf6" label="Confidence Range" />
            </div>
          </div>

          {/* Simplified Chart Display */}
          <div className="h-72 relative">
            <div className="absolute inset-0 flex items-end justify-between px-4 pb-8 gap-1">
              {forecastData.map((point, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full relative">
                    {/* Confidence range */}
                    <div 
                      className="absolute bottom-0 left-0 right-0 bg-violet-500/20 rounded-t"
                      style={{ 
                        height: `${Math.max(10, (point.confidence[1] - point.confidence[0]) * 2)}%`,
                        bottom: `${point.confidence[0]}%`,
                      }}
                    />
                    {/* Predicted value */}
                    <div 
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 bg-cyan-500 rounded-t"
                      style={{ height: `${Math.max(4, point.value)}%` }}
                    />
                  </div>
                  {idx % 4 === 0 && (
                    <span className="text-xs text-slate-500">{point.time}</span>
                  )}
                </div>
              ))}
            </div>
            
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-xs text-slate-500 py-2">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0%</span>
            </div>
          </div>
        </div>
      )}

      {/* Trend Summary */}
      {predictions && predictions.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="font-semibold text-white mb-4">Trend Summary</h3>
          <div className="space-y-3">
            {predictions.map((pred) => (
              <TrendRow key={pred.metric} prediction={pred} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Trend Row Component
function TrendRow({ prediction }: { prediction: AIPredictionType }) {
  const trendColors = {
    up: 'text-red-400',
    down: 'text-green-400',
    stable: 'text-slate-400',
  };

  const trendIcons = {
    up: '↑',
    down: '↓',
    stable: '→',
  };

  const change = prediction.predicted - prediction.current;
  const changePercent = ((change / prediction.current) * 100).toFixed(1);

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
      <div className="flex items-center gap-3">
        <div className={cn("font-medium", trendColors[prediction.trend])}>
          {trendIcons[prediction.trend]}
        </div>
        <span className="text-white font-medium">{prediction.metric}</span>
      </div>
      
      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-400">
          {prediction.current.toFixed(1)}% → {prediction.predicted.toFixed(1)}%
        </span>
        <span className={cn(
          "px-2 py-0.5 rounded",
          prediction.trend === 'up' && "bg-red-500/20 text-red-400",
          prediction.trend === 'down' && "bg-green-500/20 text-green-400",
          prediction.trend === 'stable' && "bg-slate-500/20 text-slate-400",
        )}>
          {change > 0 ? '+' : ''}{changePercent}%
        </span>
        <span className="text-slate-500">
          {Math.round(prediction.confidence * 100)}% confidence
        </span>
      </div>
    </div>
  );
}

// Prediction Card
function PredictionCard({
  prediction,
}: {
  prediction: {
    id: string;
    metric: string;
    service: string;
    currentValue: string;
    predictedValue: string;
    trend: 'up' | 'down' | 'stable';
    confidence: number;
    timeframe: string;
    recommendation: string;
  };
}) {
  const trendColors = {
    up: 'bg-red-400/20 text-red-400',
    down: 'bg-green-400/20 text-green-400',
    stable: 'bg-slate-400/20 text-slate-400',
  };

  const trendLabels = {
    up: '↑ Increasing',
    down: '↓ Decreasing',
    stable: '→ Stable',
  };

  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm text-slate-400">{prediction.metric}</p>
          <p className="text-sm text-slate-500">{prediction.service}</p>
        </div>
        <div className={cn('px-2 py-1 rounded text-xs font-medium', trendColors[prediction.trend])}>
          {trendLabels[prediction.trend]}
        </div>
      </div>

      <div className="flex items-end gap-2 mb-3">
        <span className="text-2xl font-bold text-white">{prediction.predictedValue}</span>
        <span className="text-sm text-slate-500 line-through">{prediction.currentValue}</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-cyan-500"
              style={{ width: `${prediction.confidence}%` }}
            />
          </div>
          <span className="text-xs text-slate-400">{prediction.confidence}% confidence</span>
        </div>

        <p className="text-xs text-slate-500">{prediction.timeframe}</p>

        {prediction.recommendation && (
          <p className="text-sm text-violet-400">{prediction.recommendation}</p>
        )}
      </div>
    </div>
  );
}

// Legend Item
function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-slate-400">{label}</span>
    </div>
  );
}

// Skeleton Loading State
function PredictionsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="glass-card p-4 animate-pulse">
        <div className="h-8 bg-slate-800 rounded w-64" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass-card p-5 animate-pulse">
            <div className="h-20 bg-slate-800 rounded" />
          </div>
        ))}
      </div>
      
      <div className="glass-card p-6 animate-pulse">
        <div className="h-72 bg-slate-800 rounded" />
      </div>
    </div>
  );
}

// Icon Component
function Icon({ name, className }: { name: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    TrendingUp: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  };

  return icons[name] || null;
}
