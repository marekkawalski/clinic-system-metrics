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
            file_path = f'../../results/login/metrics/custom/{app}_{condition}_metrics.json'
            result = load_results(file_path)
            metrics = result['browserPerformanceTiming']

            translated_condition = translate_condition(condition)

            data_custom.append({
                'Aplikacja': app,
                'Warunek': translated_condition,
                'Czas załadowania zawartości DOM': metrics.get('domContentLoaded', 0),
                'Czas ukończenia załadowania DOM': metrics.get('domComplete', 0),
                'Czas przesłania formularza': result.get('formSubmissionTime', None)
            })

    return pd.DataFrame(data_custom)


# Data collection for Lighthouse metrics
def collect_lighthouse_metrics(apps, conditions):
    data_lighthouse = []
    for app in apps:
        for condition in conditions:
            file_path = f'../../results/login/metrics/lighthouse/{app}_{condition}_lighthouse_metrics.json'
            result = load_results(file_path)
            metrics = result['metrics']

            translated_condition = translate_condition(condition)

            data_lighthouse.append({
                'Aplikacja': app,
                'Warunek': translated_condition,
                'Czas renderowania największego fragmentu (LCP)': metrics.get('largestContentfulPaint', 0),
                'Czas do interaktywności': metrics.get('interactive', 0),
                'Całkowity czas blokowania': metrics.get('totalBlockingTime', 0),
                'Czas załadowania pierwszego znaczącego elementu': metrics.get('firstMeaningfulPaint', 0),
                'Potencjalne maksymalne FID': metrics.get('maxPotentialFID', 0),
                'Czas do pierwszego bajtu': metrics.get('timeToFirstByte', 0)
            })

    return pd.DataFrame(data_lighthouse)


# Data collection for overall Lighthouse metrics from no-throttling files
def collect_overall_lighthouse_metrics(apps):
    data_overall = []
    for app in apps:
        file_path = f'../../results/login/metrics/lighthouse/{app}_no-throttling_lighthouse_metrics.json'
        result = load_results(file_path)
        metrics = result['metrics']
        resource_summary = result['resourceSummary']
        total_requests = sum(item['requestCount'] for item in resource_summary)
        total_transfer_size = sum(item['transferSize'] for item in resource_summary)
        cumulative_layout_shift = metrics.get('cumulativeLayoutShift', 0)

        puppeteer_file_path = f'../../results/login/metrics/custom/{app}_no-throttling_metrics.json'
        puppeteer_result = load_results(puppeteer_file_path)
        puppeteer_metrics = puppeteer_result['puppeteerMetrics']

        data_overall.append({
            'Aplikacja': app,
            'Łączna liczba żądań': total_requests,
            'Łączny rozmiar transferu': total_transfer_size,
            'Przesunięcie układu (CLS)': cumulative_layout_shift,
            'Wykorzystany rozmiar sterty JS': puppeteer_metrics.get('JSHeapUsedSize', 0),
            'Całkowity rozmiar sterty JS': puppeteer_metrics.get('JSHeapTotalSize', 0)
        })

    return pd.DataFrame(data_overall)


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


# Plotting Lighthouse metrics
def plot_lighthouse_metrics(df_lighthouse):
    def plot_lighthouse_metric_comparison(df, metric, title, ylabel, lower_is_better=True):
        plt.figure(figsize=(12, 6))
        ax = sns.barplot(data=df, x='Aplikacja', y=metric, hue='Warunek', errorbar=None)
        comparison_note = " (Mniej znaczy lepiej)" if lower_is_better else " (Więcej znaczy lepiej)"
        plt.title(f"{title}{comparison_note}")
        plt.ylabel(ylabel)
        plt.xlabel('Aplikacja')

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

    plot_lighthouse_metric_comparison(df_lighthouse, 'Czas renderowania największego fragmentu (LCP)',
                                      'Porównanie czasu renderowania największego fragmentu (LCP)',
                                      'Czas (ms)')
    plot_lighthouse_metric_comparison(df_lighthouse, 'Czas załadowania pierwszego znaczącego elementu',
                                      'Porównanie czasu załadowania pierwszego znaczącego elementu',
                                      'Czas (ms)')
    plot_lighthouse_metric_comparison(df_lighthouse, 'Czas do interaktywności', 'Porównanie czasu do interaktywności',
                                      'Czas (ms)')
    plot_lighthouse_metric_comparison(df_lighthouse, 'Całkowity czas blokowania',
                                      'Porównanie całkowitego czasu blokowania',
                                      'Czas (ms)')
    plot_lighthouse_metric_comparison(df_lighthouse, 'Potencjalne maksymalne FID',
                                      'Porównanie potencjalnego maksymalnego FID',
                                      'Czas (ms)')
    plot_lighthouse_metric_comparison(df_lighthouse, 'Czas do pierwszego bajtu',
                                      'Porównanie czasu do pierwszego bajtu',
                                      'Czas (ms)')


# Plotting overall Lighthouse metrics
def plot_overall_lighthouse_metrics(df_overall):
    def plot_overall_metric_comparison(df, metric, title, ylabel, lower_is_better=True):
        plt.figure(figsize=(12, 6))
        ax = sns.barplot(data=df, x='Aplikacja', y=metric, errorbar=None)
        comparison_note = " (Mniej znaczy lepiej)" if lower_is_better else " (Więcej znaczy lepiej)"
        plt.title(f"{title}{comparison_note}")
        plt.ylabel(ylabel)
        plt.xlabel('Aplikacja')

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

    plot_overall_metric_comparison(df_overall, 'Łączna liczba żądań', 'Porównanie łącznej liczby żądań', 'Liczba',
                                   lower_is_better=True)
    plot_overall_metric_comparison(df_overall, 'Łączny rozmiar transferu', 'Porównanie łącznego rozmiaru transferu',
                                   'Rozmiar (bajty)',
                                   lower_is_better=True)
    plot_overall_metric_comparison(df_overall, 'Przesunięcie układu (CLS)', 'Porównanie przesunięcia układu (CLS)',
                                   'Wynik przesunięcia', lower_is_better=True)
    plot_overall_metric_comparison(df_overall, 'Wykorzystany rozmiar sterty JS', 'Porównanie wykorzystania sterty JS',
                                   'Rozmiar (bajty)', lower_is_better=True)
    plot_overall_metric_comparison(df_overall, 'Całkowity rozmiar sterty JS',
                                   'Porównanie całkowitego rozmiaru sterty JS',
                                   'Rozmiar (bajty)', lower_is_better=True)


# Main function to execute the data collection and plotting
def main():
    apps = ['angular', 'vue', 'react']
    conditions = ['fast3g', 'slow3g']
    cpu_conditions = ['medium-cpu', 'slow-cpu']

    # Collecting custom metrics
    df_custom = collect_custom_metrics(apps, conditions + ['no-throttling'])
    df_cpu_custom = collect_custom_metrics(apps, cpu_conditions + ['no-throttling'])

    # Collecting Lighthouse metrics separately for network and CPU conditions
    df_lighthouse_network = collect_lighthouse_metrics(apps, conditions + ['no-throttling'])
    df_lighthouse_cpu = collect_lighthouse_metrics(apps, cpu_conditions + ['no-throttling'])

    # Collecting overall Lighthouse metrics from no-throttling files
    df_overall_lighthouse = collect_overall_lighthouse_metrics(apps)

    # Plotting custom metrics
    plot_metric_comparison(df_custom, 'Czas załadowania zawartości DOM', 'Porównanie czasu załadowania zawartości DOM',
                           'Czas (ms)',
                           legend_title='Warunek sieciowy')
    plot_metric_comparison(df_custom, 'Czas ukończenia załadowania DOM', 'Porównanie czasu ukończenia załadowania DOM',
                           'Czas (ms)',
                           legend_title='Warunek sieciowy')
    plot_metric_comparison(df_custom, 'Czas przesłania formularza', 'Porównanie czasu przesłania formularza',
                           'Czas (ms)',
                           legend_title='Warunek sieciowy')
    plot_metric_comparison(df_cpu_custom, 'Czas załadowania zawartości DOM',
                           'Porównanie czasu załadowania zawartości DOM', 'Czas (ms)',
                           legend_title='Warunek CPU')
    plot_metric_comparison(df_cpu_custom, 'Czas ukończenia załadowania DOM',
                           'Porównanie czasu ukończenia załadowania DOM', 'Czas (ms)',
                           legend_title='Warunek CPU')
    plot_metric_comparison(df_cpu_custom, 'Czas przesłania formularza', 'Porównanie czasu przesłania formularza',
                           'Czas (ms)',
                           legend_title='Warunek CPU')

    # Plotting Lighthouse metrics separately for network and CPU conditions
    plot_lighthouse_metrics(df_lighthouse_network)
    plot_lighthouse_metrics(df_lighthouse_cpu)

    # Plotting overall Lighthouse metrics
    plot_overall_lighthouse_metrics(df_overall_lighthouse)


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
