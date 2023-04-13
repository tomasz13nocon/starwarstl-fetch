import wikitextparser as wtp
import pprint

with open("debug/ahsoka.wiki", "r") as f:
    wt = wtp.parse(f.read())

apps = next(templ for templ in wt.templates if templ.name.strip() == "App")
locations = wtp.parse(apps.arguments[4].value.replace("\n{{!}}", ""))

root = []

list = locations.get_lists()[0]
for i, item in enumerate(list.items):
    root.append(item)
    print("\nLIST: ", item)
    print("\nSUBLIST: ", list.sublists()[i])

# print(main_list.get_lists()[0].sublists()[0].items)
exit()

# [
#     {
#         value: Alderaan,
#         children: [
#             {
#                 value: ...
#             }
#         ]
#     }
# ]

# [
#     {
#         value: Alderaan Sector,
#         parent: None,
#     },
#     {
#         value: Alderaan,
#         parent: 0,
#     }
# ]

class Node:
    def __init__(self, value, parent=None):
        self.value = value
        self.parent = parent
        self.children = []

    def append(self, value):
        self.children.append(Node(value, self))

    def append_or_create(self, value):
        if len(self.children) == 0:
            self.append(value)
        else:
            self.children[-1].append(value)

tree = Node("locations")
current = tree

for location in locations.ifilter():
    if location == "*":
        current.append(Node(location))
        continue
    else:
        current = {
            "level": level,

        }
        level = 0

    print(level, location)
    # print(type(location), location)

# pprint.pprint(locations.filter())
