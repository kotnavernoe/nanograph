from flask import Flask, jsonify, render_template, request
from flask_cors import CORS
import psutil
import subprocess
import platform
import re
import sys
import os
from os.path import expanduser
import webbrowser
import threading
import time
import tkinter as tk
from tkinter import messagebox, ttk
import requests

if getattr(sys, 'frozen', False):
    template_folder = os.path.join(sys._MEIPASS, 'templates')
    static_folder = os.path.join(sys._MEIPASS, 'static')
else:
    template_folder = 'templates'
    static_folder = 'static'

app = Flask(__name__, static_folder=static_folder, template_folder=template_folder)
CORS(app)
URL = "http://127.0.0.1:8000"


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/ping', methods=['GET'])
def ping_host():
    host = request.args.get('host', 'google.com')
    param = '-n' if platform.system().lower() == 'windows' else '-c'
    command = ['ping', param, '1', host]
    
    try:
        result = subprocess.check_output(command, stderr=subprocess.STDOUT, universal_newlines=True)
        match = re.search(r"time[=<]([\d.]+)\s*ms", result)
        if match:
            latency = float(match.group(1))
            return jsonify({"host": host, "latency_ms": round(latency, 2)})
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    return jsonify({"host": host, "latency_ms": -1})

disk_io_start = psutil.disk_io_counters()
disk_io_start_time = time.time()

@app.route('/stats', methods=['GET'])
def get_stats():
    global disk_io_start, disk_io_start_time

    ram = psutil.virtual_memory()
    swap = psutil.swap_memory()
    home_dir = expanduser("~")
    disk = psutil.disk_usage(home_dir)
    cpu_percent = psutil.cpu_percent(interval=None)
    net_io = psutil.net_io_counters()

    cpu_temp = -1
    if hasattr(psutil, "sensors_temperatures"):
        temps = psutil.sensors_temperatures()
        if 'coretemp' in temps:
            cpu_temp = temps['coretemp'][0].current
        elif 'cpu_thermal' in temps:
            cpu_temp = temps['cpu_thermal'][0].current
    cpu_freq_mhz = psutil.cpu_freq().current if psutil.cpu_freq() else -1

    battery_percent = -1
    if hasattr(psutil, "sensors_battery"):
        battery = psutil.sensors_battery()
        if battery:
            battery_percent = battery.percent

    disk_io_end = psutil.disk_io_counters()
    disk_io_end_time = time.time()
    time_diff = disk_io_end_time - disk_io_start_time
    
    read_speed_mbs = 0
    write_speed_mbs = 0
    if time_diff > 0:
        read_bytes = disk_io_end.read_bytes - disk_io_start.read_bytes
        write_bytes = disk_io_end.write_bytes - disk_io_start.write_bytes
        read_speed_mbs = (read_bytes / time_diff) / (1024**2)
        write_speed_mbs = (write_bytes / time_diff) / (1024**2)

    disk_io_start = disk_io_end
    disk_io_start_time = disk_io_end_time

    stats = {
        "ram_used_mb": round(ram.used / (1024**2), 2),
        "ram_percent": ram.percent,
        "swap_percent": swap.percent,
        "disk_used_gb": round(disk.used / (1024**3), 2),
        "disk_percent": disk.percent,
        "disk_read_mbs": round(read_speed_mbs, 2),
        "disk_write_mbs": round(write_speed_mbs, 2),
        "cpu_percent": cpu_percent,
        "cpu_temp_c": round(cpu_temp, 1) if cpu_temp != -1 else -1,
        "cpu_freq_mhz": round(cpu_freq_mhz, 2) if cpu_freq_mhz != -1 else -1,
        "battery_percent": battery_percent,
        "net_bytes_sent": net_io.bytes_sent,
        "net_bytes_recv": net_io.bytes_recv
    }
    return jsonify(stats)

def get_memory_uss_pss_rss(process):
    try:
        return process.memory_full_info().uss
    except (psutil.AccessDenied, AttributeError):
        try:
            return process.memory_full_info().pss
        except (psutil.AccessDenied, AttributeError):
            try:
                return process.memory_info().rss
            except psutil.AccessDenied:
                return 0

@app.route('/process_stats', methods=['GET'])
def get_process_stats():
    pid = request.args.get('pid', type=int)
    include_children = request.args.get('include_children', 'false').lower() == 'true'

    if pid is None:
        return jsonify({"error": "PID is required"}), 400

    try:
        parent_process = psutil.Process(pid)
        if not parent_process.is_running():
            return jsonify({"pid": pid, "memory_mb": -1})

        total_memory_bytes = get_memory_uss_pss_rss(parent_process)

        if include_children:
            children = parent_process.children(recursive=True)
            for child in children:
                if child.is_running():
                    total_memory_bytes += get_memory_uss_pss_rss(child)
        
        total_memory_mb = total_memory_bytes / (1024 ** 2)
        return jsonify({"pid": pid, "memory_mb": round(total_memory_mb, 2)})

    except psutil.NoSuchProcess:
        return jsonify({"pid": pid, "memory_mb": -1})
    except psutil.AccessDenied:
        return jsonify({"error": "Access denied to process information"}), 403

@app.route('/shutdown', methods=['POST'])
def shutdown():
    func = request.environ.get('werkzeug.server.shutdown')
    if func is None:
        raise RuntimeError('Not running with the Werkzeug Server')
    func()
    return 'Server shutting down...'











class RoundedButton(tk.Canvas):

    def __init__(self, master=None, text:str="", radius=25, btnforeground="#000000", btnbackground="#ffffff", clicked=None, *args, **kwargs):
        super(RoundedButton, self).__init__(master, *args, **kwargs)
        self.config(bg=self.master["bg"], highlightthickness=0)
        self.btnbackground = btnbackground
        self.clicked = clicked
        self.pressed = False

        self.radius = radius        
        
        self.rect = self.round_rectangle(0, 0, 0, 0, tags="button", radius=radius, fill=btnbackground)
        self.text = self.create_text(0, 0, text=text, tags="button", fill=btnforeground, font=("SF Pro Display", 13), justify="center")

        self.tag_bind("button", "<ButtonPress-1>", self.on_press)
        self.tag_bind("button", "<ButtonRelease-1>", self.on_release)
        self.tag_bind("button", "<Enter>", self.on_enter)
        self.tag_bind("button", "<Leave>", self.on_leave)
        self.bind("<Configure>", self.resize)
        
        text_rect = self.bbox(self.text)
        if int(self["width"]) < text_rect[2]-text_rect[0]:
            self["width"] = (text_rect[2]-text_rect[0]) + 10
        
        if int(self["height"]) < text_rect[3]-text_rect[1]:
            self["height"] = (text_rect[3]-text_rect[1]) + 10
          
    def round_rectangle(self, x1, y1, x2, y2, radius=25, update=False, **kwargs): # if update is False a new rounded rectangle's id will be returned else updates existing rounded rect.
        points = [x1+radius, y1,
                x1+radius, y1,
                x2-radius, y1,
                x2-radius, y1,
                x2, y1,
                x2, y1+radius,
                x2, y1+radius,
                x2, y2-radius,
                x2, y2-radius,
                x2, y2,
                x2-radius, y2,
                x2-radius, y2,
                x1+radius, y2,
                x1+radius, y2,
                x1, y2,
                x1, y2-radius,
                x1, y2-radius,
                x1, y1+radius,
                x1, y1+radius,
                x1, y1]

        if not update:
            return self.create_polygon(points, **kwargs, smooth=True)
        
        else:
            self.coords(self.rect, points)

    def resize(self, event):
        text_bbox = self.bbox(self.text)

        if self.radius > event.width or self.radius > event.height:
            radius = min((event.width, event.height))

        else:
            radius = self.radius

        width, height = event.width, event.height

        if event.width < text_bbox[2]-text_bbox[0]:
            width = text_bbox[2]-text_bbox[0] + 30
        
        if event.height < text_bbox[3]-text_bbox[1]:  
            height = text_bbox[3]-text_bbox[1] + 30
        
        self.round_rectangle(0, 0, width, height, radius, update=True)

        bbox = self.bbox(self.rect)

        x = ((bbox[2]-bbox[0])/2) - ((text_bbox[2]-text_bbox[0])/2)
        y = ((bbox[3]-bbox[1])/2) - ((text_bbox[3]-text_bbox[1])/2)

        self.moveto(self.text, x, y - 2)

    def on_press(self, event):
        self.pressed = True
        self.itemconfig(self.rect, fill="#555555")

    def on_release(self, event):
        if self.pressed:
            self.itemconfig(self.rect, fill=self.btnbackground)
            if self.clicked is not None:
                self.clicked()
        self.pressed = False

    def on_enter(self, event):
        if self.pressed:
            self.itemconfig(self.rect, fill="#555555")

    def on_leave(self, event):
        self.pressed = False
        self.itemconfig(self.rect, fill=self.btnbackground)









if __name__ == '__main__':
    def run_flask():
        app.run(port=8000, debug=False)

    def open_browser():
        time.sleep(1.5)
        webbrowser.open(URL)

    def new_graph(event=None):
        webbrowser.open(URL)

    def quit_app():
        try:
            requests.post(f'{URL}/shutdown')
        except requests.exceptions.RequestException:
            pass
        root.quit()
        root.destroy()
        os._exit(0)

    root = tk.Tk()
    root.title("Nanograph")
    root.geometry("480x180")
    root.resizable(False, False)
    root.configure(bg='#222222')

    menubar = tk.Menu(root)
    app_menu = tk.Menu(menubar, name='apple', tearoff=0)
    app_menu.add_command(label='New Graph', command=new_graph, accelerator='Cmd+N')
    menubar.add_cascade(menu=app_menu, label='Graph')
    root.config(menu=menubar)
    root.bind('<Command-n>', new_graph)

    bold_status_label = tk.Label(root, 
                            text="Server is running!", 
                            fg="#eeeeee", 
                            bg="#222222", 
                            font=("SF Pro Display", 14, "bold"))
    bold_status_label.pack(pady=(20, 0))

    status_label = tk.Label(root, 
                            text="You can now open graphs in your browser.\nThey'll stop working when the app is quit.", 
                            fg="#eeeeee", 
                            bg="#222222", 
                            font=("SF Pro Display", 14))
    status_label.pack(pady=(0, 10))

    button_frame = tk.Frame(root, bg='#222222')
    button_frame.pack(pady=10)

    new_btn = RoundedButton(master=button_frame, text="New Graph", radius=10, btnbackground="#3a3a3a", btnforeground="#cccccc", clicked=new_graph, width=100, height=25)
    new_btn.pack(side='left', padx=8)

    quit_btn = RoundedButton(master=button_frame, text="Quit", radius=10, btnbackground="#3a3a3a", btnforeground="#cccccc", clicked=quit_app, width=70, height=25)
    quit_btn.pack(side='left', padx=8)

    footer_label = tk.Label(root, text="by @kotnavernoe", fg="#888888", bg="#222222", font=("SF Pro Display", 11))
    footer_label.pack(side='bottom', fill='x', pady=5)

    root.update_idletasks()
    x = (root.winfo_screenwidth() // 2) - (root.winfo_width() // 2)
    y = (root.winfo_screenheight() // 2) - (root.winfo_height() // 2)
    root.geometry(f'+{x}+{y}')
    
    root.protocol("WM_DELETE_WINDOW", quit_app)

    flask_thread = threading.Thread(target=run_flask)
    flask_thread.daemon = True
    flask_thread.start()

    root.mainloop()
