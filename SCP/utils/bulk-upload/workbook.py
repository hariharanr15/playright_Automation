"""Read/write XLSX fixtures without third-party packages or modifying source templates."""
import json
import pathlib
import posixpath
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
N = {'s': NS}
ET.register_namespace('', NS)


def sheets(archive):
    relationships = ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
    targets = {r.get('Id'): r.get('Target') for r in relationships}
    workbook = ET.fromstring(archive.read('xl/workbook.xml'))
    for sheet in workbook.find('s:sheets', N):
        target = targets[sheet.get('{' + REL + '}id')]
        yield sheet.get('name'), (target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/' + target))


def strings(archive):
    if 'xl/sharedStrings.xml' not in archive.namelist():
        return []
    return [''.join(e.itertext()) for e in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('s:si', N)]


def cell_value(cell, shared):
    value = cell.find('s:v', N)
    if cell.get('t') == 'inlineStr':
        inline = cell.find('s:is', N)
        return ''.join(inline.itertext()) if inline is not None else ''
    if value is None:
        return ''
    if cell.get('t') == 's':
        return shared[int(value.text)]
    return value.text or ''


def read(file):
    result = {}
    with zipfile.ZipFile(file) as archive:
        shared = strings(archive)
        for name, target in sheets(archive):
            root = ET.fromstring(archive.read(target))
            result[name] = [
                {c.get('r'): cell_value(c, shared) for c in row}
                for row in root.findall('s:sheetData/s:row', N)
            ]
    return result


def write(payload):
    source, output = pathlib.Path(payload['template']), pathlib.Path(payload['output'])
    if source.resolve() == output.resolve():
        raise ValueError('A source template must never be overwritten')
    rows = payload['rows']
    if not rows:
        raise ValueError('The upload needs at least one explicit data row')
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(source) as archive:
        target = dict(sheets(archive))[payload['sheet']]
        root = ET.fromstring(archive.read(target))
        data = root.find('s:sheetData', N)
        shared = strings(archive)
        header = data.find('s:row', N)
        headers = [cell_value(c, shared) for c in header]
        if headers != payload['headers']:
            raise ValueError('Template headers changed: ' + repr(headers))
        for row in list(data):
            if row is not header:
                data.remove(row)
        for index, values in enumerate(rows, 2):
            if set(values) != set(headers):
                raise ValueError('Every generated row must explicitly define all columns')
            row = ET.SubElement(data, '{' + NS + '}row', {'r': str(index)})
            for col, label in enumerate(headers):
                reference = chr(ord('A') + col) + str(index)
                value = values[label]
                cell = ET.SubElement(row, '{' + NS + '}c', {'r': reference})
                if isinstance(value, (int, float)):
                    ET.SubElement(cell, '{' + NS + '}v').text = str(value)
                else:
                    cell.set('t', 'inlineStr')
                    ET.SubElement(ET.SubElement(cell, '{' + NS + '}is'), '{' + NS + '}t').text = str(value)
        dimension = root.find('s:dimension', N)
        if dimension is not None:
            dimension.set('ref', 'A1:' + chr(ord('A') + len(headers) - 1) + str(len(rows) + 1))
        with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as destination:
            for entry in archive.infolist():
                destination.writestr(entry, ET.tostring(root, encoding='utf-8', xml_declaration=True) if entry.filename == target else archive.read(entry.filename))
    return {'output': str(output), 'rows': len(rows), 'headers': headers}


if __name__ == '__main__':
    command, file = sys.argv[1:]
    print(json.dumps(read(file) if command == 'read' else write(json.loads(pathlib.Path(file).read_text(encoding='utf-8')))))
