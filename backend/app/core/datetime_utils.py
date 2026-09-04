import datetime

def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)

def utc_now_naive():
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
