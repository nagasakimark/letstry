# Word sets for the vocabulary games, and which sets each unit opens with.
# Each set takes its words and audio from a topic in the original site's lists.
SETS = {
    # id: (topic, English name, Japanese name, options)
    "feelings":    ("lt-feelings", "Feelings", "きもち", {}),
    "numbers":     ("numbers", "Numbers 1–20", "数 1–20", {"first": 20}),
    "fruitveg":    ("lt-fruitandveg", "Fruit & vegetables", "くだもの・やさい", {}),
    "stationery":  ("lt-stationery", "Stationery", "文房具", {}),
    "colors":      ("colors", "Colors", "色", {}),
    "sports":      ("lt-sports", "Sports", "スポーツ", {}),
    "foods":       ("lt-foods", "Food", "食べもの", {}),
    "ABC":         ("ABC", "Capital letters", "大文字", {"letters": True}),
    "abc":         ("abc", "Small letters", "小文字", {"letters": True}),
    "things":      ("lt-commonitems", "Things around us", "身のまわりのもの", {}),
    "shapes":      ("shapes", "Shapes", "形", {}),
    "colorshapes": ("lt-shapes", "Colors & shapes", "色と形", {"drawn": True, "first": 28}),
    "animals":     ("lt-animals", "Animals", "動物", {}),
    "describe":    ("lt-descriptions", "Describing words", "ようすをあらわすことば", {}),
    "opposites":   ("conditions", "Opposites", "反対のことば", {}),
    "countries":   ("countries", "Countries", "国", {}),
    "timesofday":  ("timesofday", "Times of day", "一日の時間", {}),
    "weather":     ("lt-weather", "Weather", "天気", {}),
    "clothes":     ("lt-clothes", "Clothes", "服", {}),
    "days":        ("lt-days", "Days of the week", "曜日", {}),
    "times":       ("lt-times", "Times of the day", "〜の時間", {}),
    "daily":       ("lt-dailyactivities", "My day", "一日の生活", {}),
    "school":      ("lt-school", "Places at school", "学校の教室", {}),
    "directions":  ("directions", "Directions", "道案内", {}),
}
UNITS = {
    "lt1": {1: ["countries"], 2: ["feelings"], 3: ["numbers", "fruitveg", "stationery"], 4: ["colors", "sports", "foods"],
            5: ["foods", "fruitveg", "sports"], 6: ["ABC", "things"], 7: ["colorshapes", "shapes", "colors", "animals"],
            8: ["animals"], 9: ["animals", "describe", "opposites"]},
    "lt2": {1: ["timesofday", "countries"], 2: ["weather", "clothes"], 3: ["days"], 4: ["times", "daily"],
            5: ["stationery"], 6: ["ABC", "abc"], 7: ["fruitveg"], 8: ["school", "directions"], 9: ["daily"]},
}
# The picture to use when the word itself isn't a picture name in the dictionary.
ALIASES = {
    "brocolli": "broccoli", "tshirt": "t-shirt", "glove": "gloves", "pudding": "puddin", "beef steak": "beef",
    "noodles": "fried noodles", "athletics": "track and field", "cycling": "road cycling",
    "school nurses office": "school nurse_s office", "school principals office": "school principal_s office",
    "teachers office": "teachers_ office", "teachers office.": "teachers_ office",
    "wake up time": "get up", "breakfast time": "breakfast", "lunch time": "lunch", "snack time": "snack",
    "homework time": "do my homework", "dinner time": "dinner", "bath time": "take a bath", "bed time": "go to bed",
    "finish my dinner": "have dinner", "study time": "study english", "u.k.": None, "football": "soccer",
}
# Which picture folder to prefer when a name appears in several (e.g. "orange" the fruit vs the colour).
PREFER = {
    "fruitveg": ["Fruit + Vegetables"], "colors": ["Colors"], "foods": ["Food", "Dessert", "Meat", "Fruit + Vegetables"],
    "things": ["Things Around You", "Nature"], "stationery": ["Stationery", "Things Around You"],
    "animals": ["Animals", "Bugs", "Sea Animals"], "describe": ["Personality", "Thoughts & Appearances", "State"],
    "opposites": ["State"], "weather": ["Weather"], "clothes": ["Clothes"], "school": ["School"],
    "directions": ["Directions"], "sports": ["Sports"], "feelings": ["Feelings"], "timesofday": ["Daily Life"],
    "times": ["Daily Life", "Meals"], "daily": ["Daily Life"], "shapes": ["Shapes"], "days": ["Days of the Week"],
    "numbers": ["Numbers"],
}

# Getting Around: rooms around school, and two sets of places around town (word, picture)
GA = {
    "school": [("classroom", "Classroom"), ("computer room", "Computer Room"), ("gym", "Gym"), ("library", "Library"),
               ("music room", "Music Room"), ("playground", "Playground"), ("restroom", "Restroom"),
               ("nurse's office", "School Nurse_s Office"), ("principal's office", "School Principal_s Office"),
               ("swimming pool", "Swimming Pool"), ("teachers' office", "Teachers_ Office"), ("entrance", "Entrance")],
    "town1": [("elementary school", "Elementary School"), ("junior high school", "Junior High School"), ("park", "Park"),
              ("bus stop", "Bus Stop"), ("hospital", "Hospital"), ("police station", "Police Station"),
              ("fire station", "Fire Station"), ("post office", "Post Office"), ("bookstore", "Bookstore"),
              ("convenience store", "Convenience Store"), ("church", "Church"), ("supermarket", "Supermarket"), ("station", "Station")],
    "town2": [("house", "House"), ("shrine", "Shrine"), ("temple", "Temple"), ("castle", "Castle"), ("library", "Library"),
              ("restaurant", "Restaurant"), ("museum", "Museum"), ("amusement park", "Amusement Park"), ("aquarium", "Aquarium"),
              ("stadium", "Stadium"), ("zoo", "Zoo"), ("supermarket", "Supermarket"), ("bus stop", "Bus Stop")],
}
