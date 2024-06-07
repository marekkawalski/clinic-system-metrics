import json
import matplotlib.pyplot as plt
import os


def load_metrics(app_type):
    file_path = os.path.abspath(f'../../results/login/{app_type}-metrics.json')
    with open(file_path, 'r') as file:
        return json.load(file)


def plot_metric(metrics, metric_name, app_type):
    values = [entry['value'] for entry in metrics if entry['name'] == metric_name]

    if not values:
        print(f"No data found for {metric_name}")
        return

    plt.figure()
    plt.plot(values)
    plt.title(f'{metric_name} for {app_type}')
    plt.xlabel('Measurement')
    plt.ylabel(metric_name)
    plt.grid(True)
    plt.savefig(os.path.abspath(f'../../results/login/{app_type}-{metric_name}.png'))
    plt.close()


def main():
    app_types = ['angular']
    metric_names = [
        'Timestamp', 'Documents', 'Frames', 'JSEventListeners', 'LayoutObjects',
        'Nodes', 'Resources', 'LayoutCount', 'RecalcStyleCount', 'LayoutDuration',
        'RecalcStyleDuration', 'ScriptDuration', 'TaskDuration', 'JSHeapUsedSize',
        'JSHeapTotalSize', 'FirstMeaningfulPaint', 'DomContentLoaded', 'NavigationStart'
    ]

    for app_type in app_types:
        metrics = load_metrics(app_type)
        for metric_name in metric_names:
            plot_metric(metrics, metric_name, app_type)


if __name__ == '__main__':
    main()
