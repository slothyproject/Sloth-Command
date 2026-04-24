window.DissidentCharts = (function () {
    function getComputedTheme() {
        var style = getComputedStyle(document.documentElement);
        return {
            primary: style.getPropertyValue('--primary').trim() || '#a855f7',
            secondary: style.getPropertyValue('--secondary').trim() || '#06b6d4',
            background: style.getPropertyValue('--background').trim() || '#0d1117',
            foreground: style.getPropertyValue('--foreground').trim() || '#e6edf3',
            muted: style.getPropertyValue('--muted-foreground').trim() || '#8b949e',
            border: style.getPropertyValue('--border').trim() || '#30363d',
            chart1: style.getPropertyValue('--chart-1').trim() || 'rgba(168, 85, 247, 0.1)',
            chart3: style.getPropertyValue('--chart-3').trim() || '#c084fc',
            chart4: style.getPropertyValue('--chart-4').trim() || '#7e22ce',
            chart5: style.getPropertyValue('--chart-5').trim() || '#06b6d4',
            chart6: style.getPropertyValue('--chart-6').trim() || '#22d3ee',
            chart7: style.getPropertyValue('--chart-7').trim() || '#f97316'
        };
    }

    function baseOptions(overrides) {
        var t = getComputedTheme();
        var opts = {
            chart: {
                background: 'transparent',
                fontFamily: 'Inter, system-ui, sans-serif',
                toolbar: { show: false },
                animations: { enabled: true, dynamicAnimation: { speed: 400 } }
            },
            theme: { mode: t.background === '#ffffff' || t.background === '#f8fafc' ? 'light' : 'dark' },
            colors: [t.primary, t.secondary, t.chart3, t.chart4, t.chart5, t.chart6, t.chart7],
            grid: {
                borderColor: t.border,
                strokeDashArray: 0,
                xaxis: { lines: { show: false } },
                yaxis: { lines: { show: true } }
            },
            xaxis: {
                labels: { style: { colors: t.muted, fontSize: '11px' } },
                axisBorder: { show: false },
                axisTicks: { show: false }
            },
            yaxis: {
                labels: { style: { colors: t.muted, fontSize: '11px' } }
            },
            tooltip: {
                theme: t.background === '#ffffff' || t.background === '#f8fafc' ? 'light' : 'dark',
                style: { fontSize: '12px' }
            },
            legend: {
                labels: { colors: t.muted },
                fontSize: '12px',
                markers: { width: 8, height: 8, radius: 2 }
            }
        };
        if (overrides) deepMerge(opts, overrides);
        return opts;
    }

    function areaChart(el, series, categories, overrides) {
        return new ApexCharts(el, baseOptions({
            chart: { type: 'area', height: '100%', zoom: { enabled: false } },
            series: series,
            xaxis: { categories: categories, type: 'category' },
            stroke: { curve: 'smooth', width: 2 },
            fill: {
                type: 'gradient',
                gradient: { opacityFrom: 0.4, opacityTo: 0.05 }
            },
            dataLabels: { enabled: false },
            markers: { size: 0, hover: { size: 5 } }
        }, overrides));
    }

    function lineChart(el, series, categories, overrides) {
        return new ApexCharts(el, baseOptions({
            chart: { type: 'line', height: '100%', zoom: { enabled: false } },
            series: series,
            xaxis: { categories: categories, type: 'category' },
            stroke: { curve: 'smooth', width: 2 },
            dataLabels: { enabled: false },
            markers: { size: 0, hover: { size: 5 } }
        }, overrides));
    }

    function donutChart(el, labels, values, overrides) {
        return new ApexCharts(el, baseOptions({
            chart: { type: 'donut', height: '100%' },
            labels: labels,
            series: values,
            plotOptions: {
                pie: { donut: { size: '70%', labels: { show: false } } }
            },
            dataLabels: { enabled: false },
            legend: { show: true, position: 'bottom' },
            stroke: { width: 0 }
        }, overrides));
    }

    function barChart(el, series, categories, overrides) {
        return new ApexCharts(el, baseOptions({
            chart: { type: 'bar', height: '100%' },
            series: series,
            xaxis: { categories: categories, type: 'category' },
            plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
            dataLabels: { enabled: false }
        }, overrides));
    }

    function sparkline(el, data, color) {
        var t = getComputedTheme();
        return new ApexCharts(el, {
            chart: { type: 'area', height: 40, sparkline: { enabled: true }, background: 'transparent' },
            series: [{ data: data }],
            colors: [color || t.primary],
            stroke: { curve: 'smooth', width: 2 },
            fill: { type: 'gradient', gradient: { opacityFrom: 0.3, opacityTo: 0 } },
            tooltip: { enabled: false },
            xaxis: { labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false } },
            yaxis: { show: false },
            grid: { show: false },
            theme: { mode: t.background === '#ffffff' || t.background === '#f8fafc' ? 'light' : 'dark' }
        });
    }

    function deepMerge(target, source) {
        for (var key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!target[key]) target[key] = {};
                deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
        return target;
    }

    function refreshAll() {
        ApexCharts.exec('all', 'updateOptions', baseOptions());
    }

    window.addEventListener('theme-changed', function () {
        setTimeout(refreshAll, 100);
    });

    return {
        getComputedTheme: getComputedTheme,
        baseOptions: baseOptions,
        areaChart: areaChart,
        lineChart: lineChart,
        donutChart: donutChart,
        barChart: barChart,
        sparkline: sparkline,
        refreshAll: refreshAll
    };
})();