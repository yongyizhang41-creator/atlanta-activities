def overlap(start_a, end_a, start_b, end_b):
    if end_a is None or end_b is None:
        return None
    start, end = max(start_a, start_b), min(end_a, end_b)
    return (start, end) if start < end else None
