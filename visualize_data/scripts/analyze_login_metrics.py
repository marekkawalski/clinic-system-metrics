import json

import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns


# Function to load JSON results
def load_results(file_path):
    with open(file_path, 'r') as file:
        return json.load(file)


# Function to collect metrics from JSON files
def collect_metrics(apps, conditions, metric_files, metrics_to_collect):
    data = []
    for app in apps:
        for condition in conditions:
            file_path = metric_files.format(app, condition)
            result = load_results(file_path)
            translated_condition = translate_condition(condition)

            metrics = {}
            for metric, (metric_source, metric_key) in metrics_to_collect.items():
                if isinstance(result.get(metric_source), list):
                    metrics[metric] = sum(item.get(metric_key, 0) for item in result.get(metric_source, []))
                else:
                    if metric_key:  # if metric_key is provided
                        metrics[metric] = result.get(metric_source, {}).get(metric_key, 0)
                    else:  # if metric_key is not provided
                        metrics[metric] = result.get(metric_source, 0)

            metrics.update({
                'Aplikacja': app,
                'Warunek': translated_condition,
            })

            data.append(metrics)

    return pd.DataFrame(data)


# Plotting function with exact values on bars
def plot_metric_comparison(df, metric, title, ylabel, lower_is_better=True, legend_title='Warunek'):
    plt.figure(figsize=(12, 6))
    ax = sns.barplot(data=df, x='Aplikacja', y=metric, hue='Warunek', errorbar=None)
    comparison_note = " (Mniej znaczy lepiej)" if lower_is_better else " (Więcej znaczy lepiej)"
    plt.title(f"{title}{comparison_note}")
    plt.ylabel(ylabel)
    plt.xlabel('Aplikacja')
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


# Function to plot multiple metrics
def plot_metrics(df, metrics_to_plot):
    for metric, details in metrics_to_plot.items():
        plot_metric_comparison(
            df,
            metric,
            details['title'],
            details['ylabel'],
            details.get('lower_is_better', True),
            details.get('legend_title', 'Warunek')
        )


# Main function to execute the data collection and plotting
def main():
    apps = ['angular', 'vue', 'react']
    conditions = ['fast3g', 'slow3g']
    cpu_conditions = ['medium-cpu', 'slow-cpu']

    # Metrics to collect
    custom_metrics_to_collect = {
        'Czas załadowania zawartości DOM': ('browserPerformanceTiming', 'domContentLoaded'),
        'Czas ukończenia załadowania DOM': ('browserPerformanceTiming', 'domComplete'),
        'Czas przesłania formularza': ('formSubmissionTime', '')
    }

    lighthouse_metrics_to_collect = {
        'Czas renderowania największego fragmentu (LCP)': ('metrics', 'largestContentfulPaint'),
        'Czas do interaktywności': ('metrics', 'interactive'),
        'Całkowity czas blokowania': ('metrics', 'totalBlockingTime'),
        'Czas załadowania pierwszego znaczącego elementu': ('metrics', 'firstMeaningfulPaint'),
        'Potencjalne maksymalne FID': ('metrics', 'maxPotentialFID'),
        'Czas do pierwszego bajtu': ('metrics', 'timeToFirstByte')
    }

    overall_lighthouse_metrics_to_collect = {
        'Łączna liczba żądań': ('resourceSummary', 'requestCount'),
        'Łączny rozmiar transferu': ('resourceSummary', 'transferSize'),
        'Przesunięcie układu (CLS)': ('metrics', 'cumulativeLayoutShift')
    }

    overall_puppeteer_metrics_to_collect = {
        'Wykorzystany rozmiar sterty JS': ('puppeteerMetrics', 'JSHeapUsedSize'),
        'Całkowity rozmiar sterty JS': ('puppeteerMetrics', 'JSHeapTotalSize')
    }

    # Metrics to plot
    metrics_to_plot = {
        'Czas załadowania zawartości DOM': {
            'title': 'Porównanie czasu załadowania zawartości DOM',
            'ylabel': 'Czas (ms)',
            'legend_title': 'Warunek sieciowy'
        },
        'Czas ukończenia załadowania DOM': {
            'title': 'Porównanie czasu ukończenia załadowania DOM',
            'ylabel': 'Czas (ms)',
            'legend_title': 'Warunek sieciowy'
        },
        'Czas przesłania formularza': {
            'title': 'Porównanie czasu przesłania formularza',
            'ylabel': 'Czas (ms)',
            'legend_title': 'Warunek sieciowy'
        },
        'Czas renderowania największego fragmentu (LCP)': {
            'title': 'Porównanie czasu renderowania największego fragmentu (LCP)',
            'ylabel': 'Czas (ms)'
        },
        'Czas załadowania pierwszego znaczącego elementu': {
            'title': 'Porównanie czasu załadowania pierwszego znaczącego elementu',
            'ylabel': 'Czas (ms)'
        },
        'Czas do interaktywności': {
            'title': 'Porównanie czasu do interaktywności',
            'ylabel': 'Czas (ms)'
        },
        'Całkowity czas blokowania': {
            'title': 'Porównanie całkowitego czasu blokowania',
            'ylabel': 'Czas (ms)'
        },
        'Potencjalne maksymalne FID': {
            'title': 'Porównanie potencjalnego maksymalnego FID',
            'ylabel': 'Czas (ms)'
        },
        'Czas do pierwszego bajtu': {
            'title': 'Porównanie czasu do pierwszego bajtu',
            'ylabel': 'Czas (ms)'
        },
        'Łączna liczba żądań': {
            'title': 'Porównanie łącznej liczby żądań',
            'ylabel': 'Liczba',
            'lower_is_better': True
        },
        'Łączny rozmiar transferu': {
            'title': 'Porównanie łącznego rozmiaru transferu',
            'ylabel': 'Rozmiar (bajty)',
            'lower_is_better': True
        },
        'Przesunięcie układu (CLS)': {
            'title': 'Porównanie przesunięcia układu (CLS)',
            'ylabel': 'Wynik przesunięcia'
        },
        'Wykorzystany rozmiar sterty JS': {
            'title': 'Porównanie wykorzystania sterty JS',
            'ylabel': 'Rozmiar (bajty)',
            'lower_is_better': True
        },
        'Całkowity rozmiar sterty JS': {
            'title': 'Porównanie całkowitego rozmiaru sterty JS',
            'ylabel': 'Rozmiar (bajty)',
            'lower_is_better': True
        }
    }

    # Collecting custom metrics
    df_custom = collect_metrics(apps, conditions + ['no-throttling'],
                                '../../results/login/metrics/custom/{}_{}_metrics.json',
                                custom_metrics_to_collect)
    df_cpu_custom = collect_metrics(apps, cpu_conditions + ['no-throttling'],
                                    '../../results/login/metrics/custom/{}_{}_metrics.json',
                                    custom_metrics_to_collect)

    # Collecting Lighthouse metrics separately for network and CPU conditions
    df_lighthouse_network = collect_metrics(apps, conditions + ['no-throttling'],
                                            '../../results/login/metrics/lighthouse/{}_{}_lighthouse_metrics.json',
                                            lighthouse_metrics_to_collect)
    df_lighthouse_cpu = collect_metrics(apps, cpu_conditions + ['no-throttling'],
                                        '../../results/login/metrics/lighthouse/{}_{}_lighthouse_metrics.json',
                                        lighthouse_metrics_to_collect)

    # Collecting overall Lighthouse metrics from no-throttling files
    df_overall_lighthouse = collect_metrics(apps, ['no-throttling'],
                                            '../../results/login/metrics/lighthouse/{}_{}_lighthouse_metrics.json',
                                            overall_lighthouse_metrics_to_collect)

    df_overall_puppeteer = collect_metrics(apps, ['no-throttling'],
                                           '../../results/login/metrics/custom/{}_{}_metrics.json',
                                           overall_puppeteer_metrics_to_collect)

    # Merging overall metrics
    df_overall = pd.merge(df_overall_lighthouse, df_overall_puppeteer, on=['Aplikacja', 'Warunek'])

    # Plotting custom metrics
    plot_metrics(df_custom, {metric: details for metric, details in metrics_to_plot.items() if
                             metric in custom_metrics_to_collect})
    plot_metrics(df_cpu_custom, {metric: details for metric, details in metrics_to_plot.items() if
                                 metric in custom_metrics_to_collect})

    # Plotting Lighthouse metrics separately for network and CPU conditions
    plot_metrics(df_lighthouse_network, {metric: details for metric, details in metrics_to_plot.items() if
                                         metric in lighthouse_metrics_to_collect})
    plot_metrics(df_lighthouse_cpu, {metric: details for metric, details in metrics_to_plot.items() if
                                     metric in lighthouse_metrics_to_collect})

    # Plotting overall Lighthouse and Puppeteer metrics
    plot_metrics(df_overall, {metric: details for metric, details in metrics_to_plot.items() if
                              metric in overall_lighthouse_metrics_to_collect or metric in overall_puppeteer_metrics_to_collect})


def translate_condition(condition):
    translations = {
        'fast3g': 'szybkie 3G',
        'slow3g': 'wolne 3G',
        'medium-cpu': 'średni procesor',
        'slow-cpu': 'wolny procesor',
        'no-throttling': 'bez ograniczeń'
    }
    return translations.get(condition, condition)


if __name__ == '__main__':
    main()
