import json

import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns


# Function to load JSON results
def load_results(file_path):
    with open(file_path, 'r') as file:
        return json.load(file)


# Data collection for custom metrics
def collect_custom_metrics(apps, conditions):
    data_custom = []
    for app in apps:
        for condition in conditions:
            file_path = f'../../results/login/metrics/custom/{app}-{condition}-metrics.json'
            result = load_results(file_path)
            metrics = result['browserPerformanceTiming']
            puppeteer_metrics = result['puppeteerMetrics']

            data_custom.append({
                'App': app,
                'Condition': condition,
                'Page Load Time': metrics.get('domComplete', 0),
                'Form Submission Time': result.get('formSubmissionTime', None),
                'Documents': puppeteer_metrics.get('Documents', 0),
                'Frames': puppeteer_metrics.get('Frames', 0),
                'JSEventListeners': puppeteer_metrics.get('JSEventListeners', 0),
                'Nodes': puppeteer_metrics.get('Nodes', 0),
                'LayoutCount': puppeteer_metrics.get('LayoutCount', 0),
                'RecalcStyleCount': puppeteer_metrics.get('RecalcStyleCount', 0),
                'LayoutDuration': puppeteer_metrics.get('LayoutDuration', 0),
                'RecalcStyleDuration': puppeteer_metrics.get('RecalcStyleDuration', 0),
                'ScriptDuration': puppeteer_metrics.get('ScriptDuration', 0),
                'TaskDuration': puppeteer_metrics.get('TaskDuration', 0),
                'JSHeapUsedSize': puppeteer_metrics.get('JSHeapUsedSize', 0),
                'JSHeapTotalSize': puppeteer_metrics.get('JSHeapTotalSize', 0)
            })

    return pd.DataFrame(data_custom)


# Data collection for custom metrics
def collect_custom_cpu_metrics(apps, cpu_conditions):
    data_custom = []
    for app in apps:
        for cpu in cpu_conditions:
            if cpu == 'noThrottling':
                file_path = f'../../results/login/metrics/custom/{app}-noThrottling-metrics.json'
            else:
                file_path = f'../../results/login/metrics/custom/{app}-{cpu}-metrics.json'
            result = load_results(file_path)
            metrics = result['browserPerformanceTiming']
            puppeteer_metrics = result['puppeteerMetrics']

            data_custom.append({
                'App': app,
                'Condition': cpu,
                'Page Load Time': metrics.get('domComplete', 0),
                'Form Submission Time': result.get('formSubmissionTime', None),
                'Documents': puppeteer_metrics.get('Documents', 0),
                'Frames': puppeteer_metrics.get('Frames', 0),
                'JSEventListeners': puppeteer_metrics.get('JSEventListeners', 0),
                'Nodes': puppeteer_metrics.get('Nodes', 0),
                'LayoutCount': puppeteer_metrics.get('LayoutCount', 0),
                'RecalcStyleCount': puppeteer_metrics.get('RecalcStyleCount', 0),
                'LayoutDuration': puppeteer_metrics.get('LayoutDuration', 0),
                'RecalcStyleDuration': puppeteer_metrics.get('RecalcStyleDuration', 0),
                'ScriptDuration': puppeteer_metrics.get('ScriptDuration', 0),
                'TaskDuration': puppeteer_metrics.get('TaskDuration', 0),
                'JSHeapUsedSize': puppeteer_metrics.get('JSHeapUsedSize', 0),
                'JSHeapTotalSize': puppeteer_metrics.get('JSHeapTotalSize', 0)
            })
    return pd.DataFrame(data_custom)


# Data collection for Lighthouse metrics
def collect_lighthouse_metrics(apps):
    data_lighthouse = []
    for app in apps:
        file_path = f'../../results/login/metrics/lighthouse/{app}-lighthouse-metrics.json'
        result = load_results(file_path)
        metrics = result['metrics']
        resource_summary = result['resourceSummary']
        data_lighthouse.append({
            'App': app,
            'First Contentful Paint': metrics.get('firstContentfulPaint', 0),
            'Total Blocking Time': metrics.get('totalBlockingTime', 0),
            'Largest Contentful Paint': metrics.get('largestContentfulPaint', 0),
            'Cumulative Layout Shift': metrics.get('cumulativeLayoutShift', 0),
            'Time to First Byte': metrics.get('timeToFirstByte', 0),
            'Interactive': metrics.get('interactive', 0),
            'Speed Index': metrics.get('speedIndex', 0),
            'Total Resource Requests': sum(item['requestCount'] for item in resource_summary),
            'Total Resource Size': sum(item['transferSize'] for item in resource_summary)
        })
    return pd.DataFrame(data_lighthouse)


# Plotting function with exact values on bars
def plot_metric_comparison(df, metric, title, ylabel, lower_is_better=True, legend_title='Network Condition'):
    plt.figure(figsize=(12, 6))
    ax = sns.barplot(data=df, x='App', y=metric, hue='Condition', errorbar=None)
    comparison_note = " (Lower is Better)" if lower_is_better else " (Higher is Better)"
    plt.title(f"{title}{comparison_note}")
    plt.ylabel(ylabel)
    plt.xlabel('App')
    plt.legend(title=legend_title)

    # Adding exact values on bars
    for p in ax.patches:
        height = p.get_height()
        if height < 1:  # For very small values, show more precision
            ax.annotate(f'{height:.5f}', (p.get_x() + p.get_width() / 2., height),
                        ha='center', va='center', fontsize=9, color='black', xytext=(0, 5),
                        textcoords='offset points')
        else:
            ax.annotate(f'{height:.1f}', (p.get_x() + p.get_width() / 2., height),
                        ha='center', va='center', fontsize=9, color='black', xytext=(0, 5),
                        textcoords='offset points')

    plt.show()


# Function to plot line plot for trends with exact values
def plot_trend(df, metric, title, ylabel, lower_is_better=True):
    plt.figure(figsize=(12, 6))
    ax = sns.lineplot(data=df, x='Condition', y=metric, hue='App', marker='o')
    comparison_note = " Trend Over Network Conditions (Lower is Better)" if lower_is_better else " Trend Over Network Conditions (Higher is Better)"
    plt.title(f"{title}{comparison_note}")
    plt.ylabel(ylabel)
    plt.xlabel('Network Condition')
    plt.legend(title='App')

    # Adding exact values on lines
    for line in ax.lines:
        for x, y in zip(line.get_xdata(), line.get_ydata()):
            if y < 1:  # For very small values, show more precision
                ax.annotate(f'{y:.5f}', (x, y), textcoords="offset points", xytext=(0, 5), ha='center')
            else:
                ax.annotate(f'{y:.1f}', (x, y), textcoords="offset points", xytext=(0, 5), ha='center')

    plt.show()


# Plotting custom metrics
def plot_custom_metrics(df_custom, legend_title='Network Condition'):
    plot_metric_comparison(df_custom, 'Page Load Time', 'Page Load Time Comparison', 'Time (ms)',
                           legend_title=legend_title)
    plot_metric_comparison(df_custom, 'Form Submission Time', 'Form Submission Time Comparison', 'Time (ms)',
                           legend_title=legend_title)
    plot_metric_comparison(df_custom, 'LayoutDuration', 'Layout Duration Comparison', 'Time (ms)',
                           legend_title=legend_title)
    plot_metric_comparison(df_custom, 'RecalcStyleDuration', 'Recalc Style Duration Comparison', 'Time (ms)',
                           legend_title=legend_title)
    plot_metric_comparison(df_custom, 'ScriptDuration', 'Script Duration Comparison', 'Time (ms)',
                           legend_title=legend_title)
    plot_metric_comparison(df_custom, 'TaskDuration', 'Task Duration Comparison', 'Time (ms)',
                           legend_title=legend_title)
    plot_metric_comparison(df_custom, 'JSHeapUsedSize', 'JS Heap Used Size Comparison', 'Size (bytes)',
                           lower_is_better=False, legend_title=legend_title)
    plot_metric_comparison(df_custom, 'JSHeapTotalSize', 'JS Heap Total Size Comparison', 'Size (bytes)',
                           lower_is_better=False, legend_title=legend_title)

    plot_trend(df_custom, 'Page Load Time', 'Page Load Time', 'Time (ms)')
    plot_trend(df_custom, 'Form Submission Time', 'Form Submission Time', 'Time (ms)')
    plot_trend(df_custom, 'RecalcStyleCount', 'Recalc Style Count', 'Count', lower_is_better=False)
    plot_trend(df_custom, 'LayoutDuration', 'Layout Duration', 'Time (ms)')
    plot_trend(df_custom, 'RecalcStyleDuration', 'Recalc Style Duration', 'Time (ms)')
    plot_trend(df_custom, 'ScriptDuration', 'Script Duration', 'Time (ms)')
    plot_trend(df_custom, 'TaskDuration', 'Task Duration', 'Time (ms)')
    plot_trend(df_custom, 'JSHeapUsedSize', 'JS Heap Used Size', 'Size (bytes)', lower_is_better=False)
    plot_trend(df_custom, 'JSHeapTotalSize', 'JS Heap Total Size', 'Size (bytes)', lower_is_better=False)


# Plotting Lighthouse metrics
def plot_lighthouse_metrics(df_lighthouse):
    def plot_lighthouse_metric_comparison(df, metric, title, ylabel, lower_is_better=True):
        plt.figure(figsize=(12, 6))
        ax = sns.barplot(data=df, x='App', y=metric, errorbar=None)
        comparison_note = " (Lower is Better)" if lower_is_better else " (Higher is Better)"
        plt.title(f"{title}{comparison_note}")
        plt.ylabel(ylabel)
        plt.xlabel('App')

        # Adding exact values on bars
        for p in ax.patches:
            height = p.get_height()
            ax.annotate(f'{height:.1f}', (p.get_x() + p.get_width() / 2., height),
                        ha='center', va='center', fontsize=9, color='black', xytext=(0, 5),
                        textcoords='offset points')

        plt.show()

    plot_lighthouse_metric_comparison(df_lighthouse, 'First Contentful Paint', 'First Contentful Paint Comparison',
                                      'Time (ms)')
    plot_lighthouse_metric_comparison(df_lighthouse, 'Total Blocking Time', 'Total Blocking Time Comparison',
                                      'Time (ms)')
    plot_lighthouse_metric_comparison(df_lighthouse, 'Largest Contentful Paint', 'Largest Contentful Paint Comparison',
                                      'Time (ms)')
    plot_lighthouse_metric_comparison(df_lighthouse, 'Cumulative Layout Shift', 'Cumulative Layout Shift Comparison',
                                      'Shift Score', lower_is_better=False)
    plot_lighthouse_metric_comparison(df_lighthouse, 'Time to First Byte', 'Time to First Byte Comparison', 'Time (ms)')
    plot_lighthouse_metric_comparison(df_lighthouse, 'Interactive', 'Time to Interactive Comparison', 'Time (ms)')
    plot_lighthouse_metric_comparison(df_lighthouse, 'Speed Index', 'Speed Index Comparison', 'Index Value')


# Main function to execute the data collection and plotting
def main():
    apps = ['angular', 'vue', 'react']
    conditions = ['noThrottling', 'fast3G', 'slow3G']
    cpu_conditions = ['noThrottling', 'medium-cpu', 'slow-cpu']

    df_custom = collect_custom_metrics(apps, conditions)
    df_cpu_custom = collect_custom_cpu_metrics(apps, cpu_conditions)
    df_lighthouse = collect_lighthouse_metrics(apps)

    plot_custom_metrics(df_custom)
    plot_custom_metrics(df_cpu_custom, 'CPU throttling conditions')
    plot_lighthouse_metrics(df_lighthouse)


if __name__ == '__main__':
    main()
