
    # "1QZaKLpvi3ZqigaxF1n4sYQ57jO6XY5wW6CiYzWA56OA"

import gspread


gc = gspread.service_account(
    filename="credentials.json"
)

sheet = gc.open_by_key(
    "1QZaKLpvi3ZqigaxF1n4sYQ57jO6XY5wW6CiYzWA56OA"
)

worksheet = sheet.get_worksheet(0)

datos = worksheet.get_all_values()

for i, fila in enumerate(datos[:40]):
    print(i, fila)