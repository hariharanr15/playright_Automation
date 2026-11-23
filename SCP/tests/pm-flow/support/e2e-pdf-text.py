"""Prints the text of a PDF (used by the E2E smoke to read the GRN). Usage: python e2e-pdf-text.py <file.pdf>"""
import sys

from pypdf import PdfReader

reader = PdfReader(sys.argv[1])
print("\n".join((page.extract_text() or "") for page in reader.pages))
