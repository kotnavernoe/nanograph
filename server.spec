# -*- mode: python ; coding: utf-8 -*-
import platform


a = Analysis(
    ['server.py'],
    pathex=[],
    binaries=[],
    datas=[('templates', 'templates'), ('static', 'static')],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='assets/icon-windows.ico' if platform.system() == 'Windows' else None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='server',
)

if platform.system() == 'Darwin':
    info_plist = {
        'CFBundleName': 'Nanograph',
        'CFBundleDisplayName': 'Nanograph',
        'CFBundleVersion': '0.0.1',
        'CFBundleShortVersionString': '0.0.1'
    }
    app = BUNDLE(
        coll,
        name='Nanograph.app',
        icon='assets/icon-mac.icns',
        bundle_identifier='com.nanograph',
        info_plist=info_plist,
    )
