
from rest_framework import serializers
from .models import BoatMeasurements, BoatGearAssignment, BoatGearTypeAssignment, BoatGearSubtypeAssignment, GearSubtype, GearType

class GearTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = GearType
        fields = "__all__"

class GearSubtypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = GearSubtype
        fields = "__all__"

class BoatMeasurementsSerializer(serializers.ModelSerializer):
    class Meta:
        model = BoatMeasurements
        fields = '__all__'


class BoatGearSubtypeAssignmentSerializer(serializers.ModelSerializer):
    gear_subtype = GearSubtypeSerializer(read_only=True)
    gear_subtype_id = serializers.PrimaryKeyRelatedField(
        queryset=GearSubtype.objects.all(),
        source="gear_subtype",
        write_only=True
    )

    class Meta:
        model = BoatGearSubtypeAssignment
        fields = [
            "id",
            "boat_gear_assignment",
            "gear_subtype",
            "gear_subtype_id",
            "is_present",
            "quantity",
        ]


class BoatGearTypeAssignmentSerializer(serializers.ModelSerializer):
    gear_type = GearTypeSerializer(read_only=True)
    gear_type_id = serializers.PrimaryKeyRelatedField(
        queryset=GearType.objects.all(),
        source="gear_type",
        write_only=True
    )
    subtypes = BoatGearSubtypeAssignmentSerializer(many=True, write_only=True, required=False)
    subtypes_data = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = BoatGearTypeAssignment
        fields = [
            "id",
            "boat_gear_assignment",
            "gear_type",
            "gear_type_id",
            "is_present",
            "subtypes",        # for create/update
            "subtypes_data",   # for GET
        ]

    def get_subtypes_data(self, obj):
        qs = BoatGearSubtypeAssignment.objects.filter(
            boat_gear_assignment=obj.boat_gear_assignment,
            gear_subtype__gear_type=obj.gear_type
        )
        return BoatGearSubtypeAssignmentSerializer(qs, many=True).data

    def create(self, validated_data):
        subtypes_data = validated_data.pop("subtypes", [])
        type_assignment = BoatGearTypeAssignment.objects.create(**validated_data)
        for subtype in subtypes_data:
            BoatGearSubtypeAssignment.objects.create(
                boat_gear_assignment=type_assignment.boat_gear_assignment,
                **subtype
            )
        return type_assignment


class BoatGearAssignmentSerializer(serializers.ModelSerializer):
    types = BoatGearTypeAssignmentSerializer(many=True, write_only=True, required=False)
    types_data = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = BoatGearAssignment
        fields = ["id", "boat", "types", "types_data"]

    def get_types_data(self, obj):
        qs = BoatGearTypeAssignment.objects.filter(boat_gear_assignment=obj)
        return BoatGearTypeAssignmentSerializer(qs, many=True).data

    def create(self, validated_data):
        types_data = validated_data.pop("types", [])
        assignment = BoatGearAssignment.objects.create(**validated_data)
        for type_data in types_data:
            subtypes = type_data.pop("subtypes", [])
            type_assignment = BoatGearTypeAssignment.objects.create(
                boat_gear_assignment=assignment,
                **type_data
            )
            for subtype in subtypes:
                BoatGearSubtypeAssignment.objects.create(
                    boat_gear_assignment=assignment,
                    **subtype
                )
        return assignment