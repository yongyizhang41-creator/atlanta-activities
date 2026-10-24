import httpx
import pytest

from app.ingestion.geocoding import NominatimGeocoder


def test_cache_survives_restart_and_requests_are_rate_limited(tmp_path):
    calls = []
    clock = [100.0]

    def sleep(seconds):
        clock[0] += seconds

    def endpoint(request):
        calls.append(request)
        assert request.url.params["bounded"] == "1"
        assert "AtlantaActivities" in request.headers["user-agent"]
        assert "key" not in request.url.params
        return httpx.Response(200, json=[{"lon": "-84.3963", "lat": "33.7756"}])

    def make():
        return NominatimGeocoder(
            tmp_path / "cache.sqlite",
            transport=httpx.MockTransport(endpoint),
            clock=lambda: clock[0],
            sleep=sleep,
        )

    assert make().locate("Campus building") == (-84.3963, 33.7756)
    assert make().locate(" campus BUILDING ") == (-84.3963, 33.7756)
    make().locate("Other building")
    assert len(calls) == 2
    assert clock[0] >= 116


@pytest.mark.parametrize("result", [[], [{"lon": "-80", "lat": "33.77"}], [{"lon": "nan", "lat": "33.77"}]])
def test_missing_and_outside_results_are_cached_without_publishing(tmp_path, result):
    calls = []

    def endpoint(request):
        calls.append(request)
        return httpx.Response(200, json=result)

    geocoder = NominatimGeocoder(tmp_path / "cache.sqlite", transport=httpx.MockTransport(endpoint))
    for _ in range(2):
        with pytest.raises(ValueError):
            geocoder.locate("Unknown place")
    assert len(calls) == 1


def test_outage_does_not_cache_a_missing_place(tmp_path):
    responses = iter([httpx.Response(503), httpx.Response(200, json=[{"lon": "-84.3963", "lat": "33.7756"}])])
    clock = [100.0]
    geocoder = NominatimGeocoder(
        tmp_path / "cache.sqlite",
        transport=httpx.MockTransport(lambda r: next(responses)),
        clock=lambda: clock[0],
        sleep=lambda n: clock.__setitem__(0, clock[0] + n),
    )
    with pytest.raises(httpx.HTTPStatusError):
        geocoder.locate("Building")
    assert geocoder.locate("Building") == (-84.3963, 33.7756)
