from collections import defaultdict, deque

class MultiValueDict:
    def __init__(self, iterable=None):
        self._data = defaultdict(deque)
        if iterable is not None:
            for k, v in iterable:
                self._data[k].append(v)

    def __setitem__(self, key, value):
        """Přidá novou hodnotu ke klíči (na konec fronty)."""
        self._data[key].append(value)

    def __getitem__(self, key):
        """Vrátí první hodnotu z fronty a odstraní ji jen pokud není poslední."""
        if key not in self._data or not self._data[key]:
            raise KeyError(key)
        queue = self._data[key]
        if len(queue) > 1:
            return queue.popleft()
        else:
            return queue[0]

    def __contains__(self, key):
        return key in self._data and len(self._data[key]) > 0

    def __iter__(self):
        """Iteruje přes všechny dvojice (klíč, hodnota)."""
        for k, queue in self._data.items():
            for v in queue:
                yield (k, v)

    def __len__(self):
        return sum(len(q) for q in self._data.values())

    def __repr__(self):
        items = ', '.join(f"{k}: {list(v)}" for k, v in self._data.items())
        return f"{self.__class__.__name__}({{{items}}})"
