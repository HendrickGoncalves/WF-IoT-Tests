
import random
import time
import threading

def get_temperature():
    return random.randrange(0, 30, 1)

def get_humidity():
    return random.randrange(40, 60, 1)

def get_device_id(arg1, arg2):
    return random.randrange(arg1, arg2, 1)

def get_light():
    return random.randrange(0, 300, 1)

def get_location():
    r1 = random.randrange(20, 29, 1)
    r2 = random.randrange(45, 52, 1)
    result = "-{}.97379220413833, -{}.1948171667824".format(r1, r2)
    
    return result

#0;28;55;11;-29.97379220413833, -51.1948171667824
def write_device_data(node_id):
    while True:
        print("\nReading temperature and humidity...")
        
        if node_id == 0:
            device = get_device_id(0, 5)
            with open("Nodes/Farm1/Node{}/Devices/device{}.txt".format(node_id, device), "w") as f:
                print("Node{} sending...".format(node_id))
                f.write("{};{};{};{};{}".format(device, get_temperature(), get_humidity(), get_light(), get_location()))
            time.sleep(30)
        elif node_id == 1:
            device = get_device_id(6, 10) #excluding device6 because it can generate a bug... i need to reset the smart contracts again
            with open("Nodes/Farm1/Node{}/Devices/device{}.txt".format(node_id, device), "w") as f:
                print("Node{} sending...".format(node_id))
                f.write("{};{};{};{};{}".format(device, get_temperature(), get_humidity(), get_light(), get_location()))
            time.sleep(45)

if __name__ == "__main__":
    thread1 = threading.Thread(target=write_device_data, args=(0,))
    thread2 = threading.Thread(target=write_device_data, args=(1,))

    thread1.start()
    thread2.start()

    while True:
        pass