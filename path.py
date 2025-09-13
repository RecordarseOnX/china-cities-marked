import os

IGNORE_DIRS = {".git", "node_modules"}

def list_dir(path, indent=0):
    try:
        items = os.listdir(path)
    except PermissionError:
        print(" " * indent + "[权限不足]")
        return
    except FileNotFoundError:
        print("路径不存在")
        return

    for item in items:
        if item in IGNORE_DIRS:  # 忽略指定文件夹
            continue

        full_path = os.path.join(path, item)
        if os.path.isdir(full_path):
            print(" " * indent + f"[目录] {item}")
            list_dir(full_path, indent + 4)  # 递归进入子文件夹
        else:
            print(" " * indent + f"- {item}")

if __name__ == "__main__":
    folder = "."  # 当前目录
    list_dir(folder)
